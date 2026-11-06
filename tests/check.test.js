import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';

const implementation = await import('../src/index.js').catch(() => null);
const roots = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
async function fixture(files) {
  const parent = await mkdtemp(join(tmpdir(), 'deployproof-test-')); roots.push(parent);
  const root = join(parent, 'artifact'); await mkdir(root);
  for (const [file, body] of Object.entries(files)) {
    await mkdir(join(root, file, '..'), { recursive: true }); await writeFile(join(root, file), body);
  }
  return { root, parent };
}
async function check(root, options = {}) {
  assert.equal(typeof implementation?.checkArtifact, 'function', 'checker implementation is required');
  return implementation.checkArtifact(root, { entry: 'server.js', ...options });
}

test('a self-contained ESM module and a literal asset are complete without executing the entry', async () => {
  const { root } = await fixture({
    'package.json': '{"type":"module"}',
    'server.js': "import './lib.js'; import {readFileSync} from 'node:fs'; readFileSync(new URL('./message.txt', import.meta.url)); throw new Error('MUST NOT EXECUTE');",
    'lib.js': 'export const answer = 42;', 'message.txt': 'synthetic',
  });
  const report = await check(root);
  assert.equal(report.structural, 'passed');
  assert.equal(report.coverage, 'complete_for_supported_static_patterns');
  assert.deepEqual(report.diagnostics, []);
  assert.equal(report.smoke.status, 'not_run');
});

test('a workspace symlink escaping the artifact is a finding without reading its target', async () => {
  const { root, parent } = await fixture({ 'server.js': "import 'workspace-lib';" });
  await mkdir(join(parent, 'private-library')); await writeFile(join(parent, 'private-library', 'index.js'), 'TOP_SECRET_SYNTHETIC_SENTINEL');
  await mkdir(join(root, 'node_modules')); await symlink('../../private-library', join(root, 'node_modules', 'workspace-lib'));
  const report = await check(root);
  assert.equal(report.structural, 'failed');
  assert.ok(report.diagnostics.some(d => d.code === 'external_symlink' && d.path === 'node_modules/workspace-lib'));
  assert.ok(!JSON.stringify(report).includes('TOP_SECRET_SYNTHETIC_SENTINEL'));
});

test('a full incomplete detail list preserves the first finding and the exit status', async t => {
  const { root, parent } = await fixture({ 'server.js': 'module.exports = 1;' });
  const realRoot = await fs.realpath(root);
  const readdir = fs.readdir;
  const unsupported = Array.from({ length: 1001 }, (_, i) => ({
    name: `special-${i}`,
    isDirectory: () => false, isSymbolicLink: () => false, isFile: () => false,
  }));
  const mock = t.mock.method(fs, 'readdir', async (path, options) => {
    const entries = await readdir(path, options);
    return path === realRoot && options?.withFileTypes ? [...unsupported, ...entries] : entries;
  });
  syncBuiltinESMExports();
  try {
    const incomplete = await check(root);
    assert.equal(implementation.exitCode(incomplete), 3);
    assert.equal(incomplete.diagnosticsTruncated, true);
    await symlink(join(parent, 'absent-external-file'), join(root, 'escape'));
    const report = await check(root);
    assert.equal(implementation.exitCode(report), 1);
    assert.equal(report.coverage, 'partial');
    assert.equal(report.diagnosticsTruncated, true);
    assert.equal(report.diagnostics.length, 1000);
    assert.ok(report.diagnostics.some(d => d.code === 'external_symlink' && d.path === 'escape'));
  } finally {
    mock.mock.restore();
    syncBuiltinESMExports();
  }
});

test('a dangling internal package link is reported, not silently ignored', async () => {
  const { root } = await fixture({ 'server.js': "import 'workspace-lib';" });
  await mkdir(join(root, 'node_modules')); await symlink('.pnpm/workspace-lib/index.js', join(root, 'node_modules', 'workspace-lib'));
  const report = await check(root);
  assert.equal(report.structural, 'failed');
  assert.ok(report.diagnostics.some(d => d.code === 'dangling_symlink'));
});

test('module resolution cannot fall back to a parent node_modules directory', async () => {
  const { root, parent } = await fixture({ 'server.js': "import 'parent-only';" });
  await mkdir(join(parent, 'node_modules', 'parent-only'), { recursive: true });
  await writeFile(join(parent, 'node_modules', 'parent-only', 'package.json'), '{"main":"index.js"}');
  await writeFile(join(parent, 'node_modules', 'parent-only', 'index.js'), 'module.exports = 1;');
  const report = await check(root);
  assert.equal(report.structural, 'failed');
  assert.ok(report.diagnostics.some(d => d.code === 'missing_dependency' && d.importer === 'server.js'));
});

test('a package with missing built output reports the importer and unresolved dependency', async () => {
  const { root } = await fixture({ 'server.js': "require('built-lib');", 'node_modules/built-lib/package.json': '{"main":"dist/index.js"}' });
  const report = await check(root);
  assert.equal(report.structural, 'failed');
  assert.ok(report.diagnostics.some(d => d.code === 'missing_dependency' && d.importer === 'server.js' && d.specifier === 'built-lib'));
});

test('a missing literal runtime asset is a finding with a dependency chain', async () => {
  const { root } = await fixture({ 'package.json': '{"type":"module"}', 'server.js': "import './lib.js';", 'lib.js': "import {readFileSync} from 'node:fs'; readFileSync(new URL('./missing.txt', import.meta.url));" });
  const report = await check(root);
  assert.equal(report.structural, 'failed');
  const asset = report.diagnostics.find(d => d.code === 'missing_asset');
  assert.equal(asset.path, 'missing.txt'); assert.equal(asset.importer, 'lib.js');
  assert.deepEqual(asset.chain, ['server.js', 'lib.js', 'missing.txt']);
});

test('runtime-computed dependencies remain partial rather than passing a universal check', async () => {
  const { root } = await fixture({ 'server.js': 'const moduleName = process.env.SYNTHETIC_PLUGIN; require(moduleName);' });
  const report = await check(root);
  assert.equal(report.coverage, 'partial');
  assert.ok(report.diagnostics.some(d => d.code === 'dynamic_dependency'));
});

test('entry traversal is rejected before any tracing', async () => {
  const { root } = await fixture({ 'server.js': '' });
  const report = await check(root, { entry: '../outside.js' });
  assert.equal(report.execution, 'invalid_input');
});

test('a symlink loop and scan exhaustion cannot become complete checks', async () => {
  const { root } = await fixture({ 'server.js': 'module.exports = 1;', 'extra.txt': '' });
  await symlink('loop-b', join(root, 'loop-a')); await symlink('loop-a', join(root, 'loop-b'));
  const loop = await check(root);
  assert.equal(loop.structural, 'failed'); assert.ok(loop.diagnostics.some(d => d.code === 'symlink_cycle'));
  const cap = await check(root, { maxFiles: 1 });
  assert.equal(cap.coverage, 'partial'); assert.ok(cap.diagnostics.some(d => d.code === 'scan_limit'));
});

test('a missing entry is a finding rather than a passing empty trace', async () => {
  const { root } = await fixture({ 'package.json': '{}' });
  const report = await check(root);
  assert.equal(report.structural, 'failed'); assert.ok(report.diagnostics.some(d => d.code === 'missing_entry'));
});

test('an unresolved trace is partial even when its missing dependency is already a finding', async () => {
  const { root } = await fixture({ 'server.js': "require('unresolved-one'); require('unresolved-two');" });
  const report = await check(root);
  assert.equal(report.coverage, 'partial');
  assert.ok(report.diagnostics.some(d => d.code === 'trace_warning'));
});

test('nested fs.promises reads with runtime paths cannot produce a complete static result', async () => {
  const { root } = await fixture({ 'server.js': "const fs = require('node:fs'); fs.promises.readFile(process.env.SYNTHETIC_ASSET);" });
  const report = await check(root);
  assert.equal(report.coverage, 'partial');
  assert.ok(report.diagnostics.some(d => d.code === 'dynamic_asset'));
});
