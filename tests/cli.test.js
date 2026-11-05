import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fakeEngine } from './fake-engine.js';
const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));
function run(args) { return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 5000 }); }

test('CLI returns distinct exits for a clean artifact, missing dependency, and partial dynamic loading', async () => {
  const root = await mkdtemp(join(tmpdir(), 'deployproof-cli-'));
  try {
    await writeFile(join(root, 'server.js'), 'module.exports = 1;');
    let result = run(['check', root, '--entry', 'server.js', '--json']);
    assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).structural, 'passed');
    await writeFile(join(root, 'server.js'), "require('absent-synthetic-lib');");
    result = run(['check', root, '--entry', 'server.js', '--json']);
    assert.equal(result.status, 1); assert.equal(JSON.parse(result.stdout).structural, 'failed');
    await writeFile(join(root, 'server.js'), 'require(process.env.PLUGIN);');
    result = run(['check', root, '--entry', 'server.js', '--json']);
    assert.equal(result.status, 3); assert.equal(JSON.parse(result.stdout).coverage, 'partial');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('CLI rejects unknown flags, absent entries and implicit smoke commands', () => {
  assert.equal(run(['check', '.', '--entri', 'server.js']).status, 2);
  assert.equal(run(['check', '.']).status, 2);
  assert.equal(run(['check', '.', '--entry', 'server.js', '--smoke-image', 'node:22-alpine']).status, 2);
});

test('the measurement gate fails when its independent baseline disagrees with a broken fixture', async () => {
  const root = await mkdtemp(join(tmpdir(), 'deployproof-measure-gate-'));
  try {
    const engine = await fakeEngine(root);
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../examples/measure.js', import.meta.url))], {
      encoding: 'utf8', timeout: 15000, env: { ...process.env, CONTAINER_CLI: engine.binary },
    });
    assert.equal(result.error, undefined);
    const report = JSON.parse(result.stdout);
    assert.equal(report.records.length, 6);
    assert.ok(report.records.some(record => record.expected === 'failed' && record.handwrittenContainer.status === 'passed'));
    assert.equal(result.status, 1, 'The measurement gate must reject the observed disagreement.');
  } finally { await rm(root, { recursive: true, force: true }); }
});
