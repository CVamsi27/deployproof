import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { smokeArtifact } from '../src/index.js';
import { containerBaseline } from '../examples/container-baseline.js';
import { fakeEngine } from './fake-engine.js';

test('the selected OrbStack client and endpoint are used by smoke and its independent baseline', async () => {
  const root = await mkdtemp(join(tmpdir(), 'deployproof-client-'));
  const artifact = join(root, 'artifact'); await mkdir(artifact); await writeFile(join(artifact, 'server.js'), 'process.exit(0);');
  const original = Object.fromEntries(['PATH', 'CONTAINER_CLI', 'CONTAINER_HOST', 'DOCKER_CONTEXT', 'DOCKER_HOST'].map(key => [key, process.env[key]]));
  try {
    await fakeEngine(root);
    const selected = await fakeEngine(root, { name: 'orb-client', marker: 'selected' });
    process.env.PATH = root + ':' + original.PATH;
    process.env.CONTAINER_CLI = selected.binary;
    process.env.CONTAINER_HOST = 'unix:///synthetic/orbstack.sock';
    process.env.DOCKER_HOST = 'unix:///synthetic/other.sock';
    process.env.DOCKER_CONTEXT = 'unrelated-context';
    const smoke = await smokeArtifact(artifact, { image: 'node:22-alpine', command: ['node', 'server.js'] });
    const baseline = containerBaseline(artifact);
    assert.equal(smoke.status, 'passed');
    assert.equal(baseline.status, 'passed');
    const calls = (await readFile(selected.log, 'utf8')).trim().split('\n').map(JSON.parse);
    assert.ok(calls.length >= 12);
    assert.ok(calls.every(call => call.marker === 'selected' && call.host === 'unix:///synthetic/orbstack.sock' && call.context === null));
    for (const launch of calls.filter(call => call.args[0] === 'create')) {
      assert.equal(launch.args.includes('--env-file'), false);
      assert.equal(launch.args.includes('unix:///synthetic/orbstack.sock'), false);
      assert.equal(launch.args.includes('unrelated-context'), false);
    }
    assert.equal(process.env.DOCKER_CONTEXT, 'unrelated-context');
    assert.equal(process.env.DOCKER_HOST, 'unix:///synthetic/other.sock');
  } finally {
    for (const [key, value] of Object.entries(original)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    await rm(root, { recursive: true, force: true });
  }
});

test('container smoke never runs an implicit application command', async () => {
  const result = await smokeArtifact('.', { image: 'node:22-alpine', command: [] });
  assert.equal(result.status, 'error'); assert.equal(result.cleanup, 'not_required');
});

test('a missing Docker prerequisite returns blocked rather than passing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'deployproof-no-docker-'));
  try {
    const result = await smokeArtifact(root, { image: 'node:22-alpine', command: ['node', 'server.js'], dockerBinary: join(root, 'missing-docker') });
    assert.equal(result.status, 'blocked'); assert.equal(result.cleanup, 'not_required');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('copying uses a never-started staging container and application execution uses its read-only snapshot', async () => {
  const root = await mkdtemp(join(tmpdir(), 'deployproof-read-only-'));
  const artifact = join(root, 'artifact'); await mkdir(artifact); await writeFile(join(artifact, 'server.js'), 'process.exit(9);');
  try {
    const engine = await fakeEngine(root, { exitCode: 9 });
    const result = await smokeArtifact(artifact, { image: 'node:22-alpine', command: ['node', 'server.js'], dockerBinary: engine.binary });
    assert.equal(result.status, 'failed'); assert.equal(result.exitCode, 9); assert.equal(result.cleanup, 'completed');
    const calls = (await readFile(engine.log, 'utf8')).trim().split('\n').map(JSON.parse).map(call => call.args);
    const creates = calls.filter(args => args[0] === 'create');
    assert.equal(creates.length, 2);
    const stage = creates.find(args => !args.includes('--read-only'));
    const worker = creates.find(args => args.includes('--read-only'));
    const stageName = stage[stage.indexOf('--name') + 1];
    const workerName = worker[worker.indexOf('--name') + 1];
    assert.ok(stage.includes('sha256:'+'b'.repeat(64)));
    assert.ok(worker.includes('sha256:'+'c'.repeat(64)));
    assert.deepEqual(calls.filter(args => args[0] === 'start').map(args => args[1]), [workerName]);
    assert.ok(calls.find(args => args[0] === 'cp').at(-1).startsWith(stageName + ':'));
    for (const args of creates) {
      assert.ok(args.includes('none')); assert.ok(args.includes('--cap-drop')); assert.ok(args.includes('ALL')); assert.ok(args.includes('--user'));
      for (const bad of ['--mount', '--volume', '-v', '--privileged', '--env-file', '--publish']) assert.equal(args.includes(bad), false);
    }
    assert.ok(calls.some(args => args[0] === 'rm' && args.includes(stageName)));
    assert.ok(calls.some(args => args[0] === 'rm' && args.includes(workerName)));
    assert.ok(calls.some(args => args[0] === 'image' && args[1] === 'rm' && args.includes('sha256:'+'c'.repeat(64))));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('ownership mismatch cannot become successful smoke cleanup', async () => {
  const root = await mkdtemp(join(tmpdir(), 'deployproof-ownership-'));
  try {
    const engine = await fakeEngine(root, { foreign: true });
    const result = await smokeArtifact(root, { image: 'node:22-alpine', command: ['node', '-e', 'process.exit(0)'], dockerBinary: engine.binary });
    assert.equal(result.cleanup, 'failed'); assert.equal(result.status, 'error');
    const calls = (await readFile(engine.log, 'utf8')).trim().split('\n').map(JSON.parse).map(call => call.args);
    assert.equal(calls.some(args => args[0] === 'rm' || args[0] === 'image' && args[1] === 'rm'), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a zero wait observation cannot pass with a missing, running, OOM-killed, or inconsistent worker state', async () => {
  for (const workerState of [{}, { Running: true, OOMKilled: false, ExitCode: 0 }, { Running: false, OOMKilled: true, ExitCode: 0 }, { Running: false, OOMKilled: false, ExitCode: 7 }]) {
    const root = await mkdtemp(join(tmpdir(), 'deployproof-terminal-'));
    try {
      const engine = await fakeEngine(root, { workerState });
      const result = await smokeArtifact(root, { image: 'node:22-alpine', command: ['node', '-e', 'process.exit(0)'], dockerBinary: engine.binary });
      assert.equal(result.status, 'error');
      assert.equal(result.cleanup, 'completed');
      assert.equal(result.exitCode, null);
    } finally { await rm(root, { recursive: true, force: true }); }
  }
});
