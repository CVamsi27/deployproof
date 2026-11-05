import { mkdir, writeFile, symlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Synthetic data only: creates a new directory and refuses an existing path. */
export async function createFixtures(target) {
  const root = resolve(target); await mkdir(root);
  const cases = [];
  async function fixture(name, files, healthy) {
    const directory = join(root, name); await mkdir(directory);
    for (const [name, data] of Object.entries(files)) { const path = join(directory, name); await mkdir(dirname(path), { recursive: true }); await writeFile(path, data); }
    const value = { name, directory, entry: 'server.js', expected: healthy ? 'passed' : 'failed' }; cases.push(value); return directory;
  }
  await mkdir(join(root, 'source-library')); await writeFile(join(root, 'source-library', 'package.json'), '{"main":"index.js"}'); await writeFile(join(root, 'source-library', 'index.js'), 'module.exports = 42;\n');
  const escaped = await fixture('workspace-link-broken', { 'server.js': "require('synthetic-library');\n" }, false);
  await mkdir(join(escaped, 'node_modules')); await symlink('../../source-library', join(escaped, 'node_modules', 'synthetic-library'));
  await fixture('workspace-link-fixed', { 'server.js': "require('synthetic-library');\n", 'node_modules/synthetic-library/package.json': '{"main":"index.js"}', 'node_modules/synthetic-library/index.js': 'module.exports = 42;\n' }, true);
  const packaged = { 'server.js': "require('synthetic-built');\n", 'node_modules/synthetic-built/package.json': '{"main":"dist/index.js"}' };
  await fixture('built-module-broken', packaged, false);
  await fixture('built-module-fixed', { ...packaged, 'node_modules/synthetic-built/dist/index.js': 'module.exports = 42;\n' }, true);
  const assets = { 'package.json': '{"type":"module"}', 'server.js': "import {readFileSync} from 'node:fs'; readFileSync(new URL('./message.txt', import.meta.url));\n" };
  await fixture('runtime-asset-broken', assets, false);
  await fixture('runtime-asset-fixed', { ...assets, 'message.txt': 'Synthetic fixture message.\n' }, true);
  return { root, cases };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  createFixtures(process.argv[2] ?? '').then(result => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)).catch(() => { process.stderr.write('Provide a new target directory; existing paths are never overwritten.\n'); process.exitCode = 2; });
}
