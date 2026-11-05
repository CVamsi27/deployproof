import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../examples/pnpm/verify.js', import.meta.url));
function run(args, root, pnpmCli, entry = cli) {
  return spawnSync(process.execPath, [entry, ...args], { cwd: root, encoding: 'utf8', timeout: 10_000,
    env: { ...process.env, PNPM_CLI: pnpmCli, TMPDIR: root, TMP: root, TEMP: root } });
}

test('invocation through a symlink still runs the example and reports its unavailable prerequisite', async () => {
  const root = await mkdtemp(join(tmpdir(), 'deployproof-pnpm-symlink-'));
  try {
    const link = join(root, 'example.js'); await symlink(cli, link);
    const result = run([], root, join(root, 'absent-pnpm'), link);
    assert.equal(result.status, 2);
    assert.equal(JSON.parse(result.stdout).reason, 'pnpm_unavailable');
    assert.deepEqual(await readdir(root), ['example.js']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the pnpm example reports a missing package manager as blocked and removes its private files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'deployproof-pnpm-unavailable-'));
  try {
    const result = run([], root, join(root, 'absent-pnpm'));
    assert.equal(result.status, 2, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.execution, 'blocked');
    assert.equal(report.passed, false);
    assert.equal(report.reason, 'pnpm_unavailable');
    assert.equal(report.cleanup, 'completed');
    assert.deepEqual(report.cases, []);
    assert.deepEqual(await readdir(root), []);
    assert.ok(!result.stdout.includes(root));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a different pnpm version cannot be recorded as a verified integration profile', async () => {
  const root = await mkdtemp(join(tmpdir(), 'deployproof-pnpm-version-'));
  try {
    const wrong = join(root, 'pnpm');
    await writeFile(wrong, '#!/usr/bin/env node\nconsole.log("0.0.0");\n', { mode: 0o700 });
    const result = run([], root, wrong);
    assert.equal(result.status, 2, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.execution, 'blocked');
    assert.equal(report.reason, 'pnpm_version_mismatch');
    assert.equal(report.passed, false);
    assert.deepEqual(report.cases, []);
    assert.deepEqual(await readdir(root), ['pnpm']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('pnpm example help and invalid arguments do not create or prepare a workspace', async () => {
  const root = await mkdtemp(join(tmpdir(), 'deployproof-pnpm-args-'));
  try {
    const help = run(['--help'], root, join(root, 'absent-pnpm'));
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /pnpm/);
    for (const args of [['--unknown'], ['./artifact'], ['--smoke-image'], ['--smoke-image=']]) {
      const result = run(args, root, join(root, 'absent-pnpm'));
      assert.equal(result.status, 2);
      assert.equal(JSON.parse(result.stdout).reason, 'invalid_arguments');
    }
    assert.deepEqual(await readdir(root), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});
