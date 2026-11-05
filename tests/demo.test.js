import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));
function run(args, root, extra = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root, env: { ...process.env, TMPDIR: root, TMP: root, TEMP: root, ...extra },
    encoding: 'utf8', timeout: 10_000,
  });
}

test('the demo observes a missing asset, repairs it and removes its private synthetic directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'deployproof-demo-test-'));
  try {
    const result = run(['demo', '--json'], root);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.passed, true);
    assert.equal(report.cleanup, 'completed');
    assert.deepEqual(report.steps.map(step => [step.id, step.observedExit]), [['broken', 1], ['fixed', 0]]);
    const finding = report.steps[0].report.diagnostics.find(item => item.code === 'missing_asset');
    assert.equal(finding.path, 'message.txt');
    assert.deepEqual(finding.chain, ['server.js', 'message.txt']);
    assert.equal(report.steps[1].report.structural, 'passed');
    assert.equal(report.steps[1].report.coverage, 'complete_for_supported_static_patterns');
    assert.ok(report.steps.every(step => step.report.smoke.status === 'not_run'));
    assert.deepEqual(await readdir(root), []);
    assert.ok(!result.stdout.includes(root), 'Demo output must not expose a host temporary path');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the human demo works with process execution disabled and explains the actual finding', async () => {
  const root = await mkdtemp(join(tmpdir(), 'deployproof-demo-host-'));
  try {
    const guard = join(root, 'guard.cjs');
    await writeFile(guard, `const cp=require('node:child_process');for(const key of ['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'])cp[key]=()=>{throw Error('Demo must not execute application or container processes');};require('node:module').syncBuiltinESMExports();`);
    const result = run(['demo'], root, { NODE_OPTIONS: `--require=${guard}` });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /missing_asset.*message\.txt/);
    assert.match(result.stdout, /server\.js -> message\.txt/);
    assert.match(result.stdout, /fixed.*passed/i);
    assert.deepEqual(await readdir(root), ['guard.cjs']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a failed demo cleanup returns a nonzero incomplete result', async () => {
  const root = await mkdtemp(join(tmpdir(), 'deployproof-demo-cleanup-'));
  try {
    const guard = join(root, 'guard.cjs');
    await writeFile(guard, `const fs=require('node:fs/promises');const original=fs.rm;fs.rm=async function(path,...args){if(String(path).includes('deployproof-demo-cell-'))throw Error('Synthetic cleanup failure');return original(path,...args);};require('node:module').syncBuiltinESMExports();`);
    const result = run(['demo', '--json'], root, { NODE_OPTIONS: `--require=${guard}` });
    assert.equal(result.status, 2);
    const report = JSON.parse(result.stdout);
    assert.equal(report.passed, false);
    assert.equal(report.cleanup, 'failed');
    assert.equal(report.steps.length, 2, 'Observed broken/fixed evidence must survive cleanup failure');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('demo rejects artifact and smoke arguments and its help creates no fixture', async () => {
  const root = await mkdtemp(join(tmpdir(), 'deployproof-demo-args-'));
  try {
    for (const args of [['demo', './artifact'], ['demo', '--entry', 'server.js'], ['demo', '--smoke-image', 'node:22-alpine'], ['demo', '--unknown']]) {
      assert.equal(run(args, root).status, 2);
    }
    const help = run(['demo', '--help'], root);
    assert.equal(help.status, 0);
    assert.match(help.stdout, /deployproof demo/);
    assert.deepEqual(await readdir(root), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});
