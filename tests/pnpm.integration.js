import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../examples/pnpm/verify.js', import.meta.url));
function run(root, extra = {}) {
  return spawnSync(process.execPath, [cli], { cwd: root, encoding: 'utf8', timeout: 90_000,
    env: { ...process.env, TMPDIR: root, TMP: root, TEMP: root, ...extra } });
}

test('real pnpm deploy provides a healthy control and diagnoses three real packaging mistakes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'deployproof-pnpm-real-'));
  try {
    const result = run(root);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.passed, true);
    assert.equal(report.cleanup, 'completed');
    assert.deepEqual(report.cases.map(item => [item.id, item.observedExit]), [
      ['deploy-contained', 0], ['ordinary-copy', 1], ['deploy-missing-asset', 1], ['deploy-missing-module', 1],
    ]);
    assert.equal(report.cases[0].report.coverage, 'complete_for_supported_static_patterns');
    assert.ok(report.cases[1].report.diagnostics.some(item => item.code === 'external_symlink'));
    const asset = report.cases[2].report.diagnostics.find(item => item.code === 'missing_asset');
    assert.ok(asset.path.endsWith('/templates/message.txt'));
    assert.equal(asset.chain[0], 'server.js');
    assert.equal(asset.chain.at(-1), asset.path);
    assert.ok(report.cases[3].report.diagnostics.some(item => item.code === 'missing_dependency' && item.specifier === '@deployproof-example/message'));
    assert.ok(report.cases.every(item => item.report.smoke.status === 'not_run'));
    assert.ok(!result.stdout.includes(root));
    assert.deepEqual(await readdir(root), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('pnpm example cleanup failure preserves all observations and returns incomplete/nonzero', async () => {
  const root = await mkdtemp(join(tmpdir(), 'deployproof-pnpm-cleanup-'));
  try {
    const guard = join(root, 'guard.cjs');
    await writeFile(guard, `const fs=require('node:fs/promises');const original=fs.rm;fs.rm=async function(path,...args){if(String(path).split(require('node:path').sep).at(-1).startsWith('deployproof-pnpm-cell-'))throw Error('Synthetic cleanup failure');return original(path,...args);};require('node:module').syncBuiltinESMExports();`);
    const result = run(root, { NODE_OPTIONS: `--require=${guard}` });
    assert.equal(result.status, 2, result.stdout + result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.cleanup, 'failed');
    assert.equal(report.passed, false);
    assert.equal(report.cases.length, 4);
  } finally { await rm(root, { recursive: true, force: true }); }
});
