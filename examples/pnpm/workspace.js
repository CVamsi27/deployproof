import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Prebuilt synthetic files only. Lifecycle scripts and app entry execution are unnecessary.
export async function createWorkspace(root, libraryFiles) {
  const files = {
    'package.json': JSON.stringify({ private: true, packageManager: 'pnpm@11.23.0' }),
    'pnpm-workspace.yaml': 'packages:\n  - packages/*\ninjectWorkspacePackages: true\nmanagePackageManagerVersions: false\npackageManagerStrictVersion: true\nignoreScripts: true\nautoInstallPeers: false\nupdateNotifier: false\n',
    '.npmrc': 'registry=https://registry.npmjs.org/\n',
    'packages/app/package.json': JSON.stringify({ name: '@deployproof-example/app', version: '1.0.0', type: 'module', files: ['server.js'], dependencies: { '@deployproof-example/message': 'workspace:*' } }),
    'packages/app/server.js': "import { message } from '@deployproof-example/message';\nif (message() !== 'Synthetic pnpm deployment.') throw new Error('Synthetic contract failed');\n",
    'packages/message/package.json': JSON.stringify({ name: '@deployproof-example/message', version: '1.0.0', type: 'module', exports: './dist/index.js', files: libraryFiles }),
    'packages/message/dist/index.js': "import { readFileSync } from 'node:fs';\nexport function message() { return readFileSync(new URL('../templates/message.txt', import.meta.url), 'utf8').trim(); }\n",
    'packages/message/templates/message.txt': 'Synthetic pnpm deployment.\n',
  };
  for (const [path, content] of Object.entries(files)) {
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), `${content}\n`);
  }
}
