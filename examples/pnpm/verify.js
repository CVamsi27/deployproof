import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { checkArtifact, exitCode, smokeArtifact } from '../../src/index.js';
import { createWorkspace } from './workspace.js';

const profiles = [
  { id: 'deploy-contained', files: ['dist', 'templates'], expectedExit: 0 },
  { id: 'ordinary-copy', files: ['dist', 'templates'], expectedExit: 1, finding: 'external_symlink' },
  { id: 'deploy-missing-asset', files: ['dist'], expectedExit: 1, finding: 'missing_asset' },
  { id: 'deploy-missing-module', files: ['templates'], expectedExit: 1, finding: 'missing_dependency' },
];

export async function runPnpmExample({ pnpmCli = process.env.PNPM_CLI ?? 'pnpm', smokeImage } = {}) {
  const result = { schemaVersion: 1, profile: 'pnpm-11.23.0', execution: 'failed', cleanup: 'completed', passed: false, cases: [] };
  let root;
  try {
    root = await mkdtemp(join(tmpdir(), 'deployproof-pnpm-cell-'));
    const config = join(root, 'empty.npmrc'); await writeFile(config, 'registry=https://registry.npmjs.org/\n');
    const globalConfig = join(root, 'global.npmrc'); await writeFile(globalConfig, '');
    const env = Object.fromEntries(['PATH', 'SystemRoot', 'TMPDIR', 'TMP', 'TEMP'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
    Object.assign(env, { TMPDIR: root, TMP: root, TEMP: root, NPM_CONFIG_USERCONFIG: config, NPM_CONFIG_GLOBALCONFIG: globalConfig,
      XDG_CONFIG_HOME: join(root, 'config'), XDG_CACHE_HOME: join(root, 'cache'), XDG_DATA_HOME: join(root, 'data'), XDG_STATE_HOME: join(root, 'state') });
    const call = (args, cwd) => spawnSync(pnpmCli, args, { cwd, env, encoding: 'utf8', timeout: 30_000, maxBuffer: 1024 * 1024 });
    const version = call(['--version'], root);
    if (version.error || version.status !== 0 || version.signal) {
      result.execution = 'blocked'; result.reason = 'pnpm_unavailable';
    } else if (version.stdout.trim() !== '11.23.0') {
      result.execution = 'blocked'; result.reason = 'pnpm_version_mismatch';
    } else {
      for (const profile of profiles) {
        const workspace = join(root, profile.id, 'workspace'), artifact = join(root, profile.id, 'artifact');
        await createWorkspace(workspace, profile.files);
        const common = ['--offline', '--ignore-scripts', '--store-dir', join(root, 'store'), '--reporter=silent'];
        const commands = [['install', '--no-frozen-lockfile', ...common]];
        if (profile.id !== 'ordinary-copy') commands.push(['--filter', '@deployproof-example/app', 'deploy', '--prod', ...common, artifact]);
        for (const args of commands) {
          const prepared = call(args, workspace);
          if (prepared.error || prepared.signal || prepared.status !== 0) {
            result.reason = args[0] === 'install' ? 'pnpm_install_failed' : 'pnpm_deploy_failed';
            result.preparation = { case: profile.id, status: prepared.status, code: `${prepared.stdout ?? ''}\n${prepared.stderr ?? ''}`.match(/ERR_PNPM_[A-Z_]+/)?.[0] ?? 'command_failed' };
            throw new Error(result.reason);
          }
        }
        if (profile.id === 'ordinary-copy') await cp(join(workspace, 'packages', 'app'), artifact, { recursive: true, dereference: false, verbatimSymlinks: true });
        const report = await checkArtifact(artifact, { entry: 'server.js' });
        if (smokeImage && report.execution === 'completed') report.smoke = await smokeArtifact(artifact, { image: smokeImage, command: ['node', 'server.js'] });
        result.cases.push({ id: profile.id, expectedExit: profile.expectedExit, observedExit: exitCode(report), report });
      }
      result.execution = 'completed';
    }
  } catch { result.reason ??= 'example_failed'; }
  finally {
    if (root) {
      try { await rm(root, { recursive: true, force: true }); }
      catch { result.cleanup = 'failed'; result.reason ??= 'cleanup_failed'; }
    }
  }
  result.passed = result.execution === 'completed' && result.cleanup === 'completed' && result.cases.length === profiles.length
    && result.cases.every((item, index) => item.observedExit === profiles[index].expectedExit
      && (!profiles[index].finding || item.report.diagnostics.some(d => d.code === profiles[index].finding))
      && (smokeImage ? item.report.smoke.cleanup === 'completed' && item.report.smoke.status === (item.expectedExit ? 'failed' : 'passed') : item.report.smoke.status === 'not_run'));
  if (!result.passed && !result.reason) result.reason = 'control_mismatch';
  return result;
}

export function exampleExitCode(report) {
  if (report.execution !== 'completed' || report.cleanup !== 'completed' || report.cases.some(item => item.observedExit === 2)) return 2;
  if (report.cases.some(item => item.observedExit === 3)) return 3;
  return report.passed ? 0 : 1;
}

let entryPath;
try { if (process.argv[1]) entryPath = realpathSync(process.argv[1]); } catch { /* Imported from a non-file entry. */ }
if (entryPath === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({ strict: true, allowPositionals: false, options: { help: { type: 'boolean', short: 'h' }, 'smoke-image': { type: 'string' } } });
    if (values['smoke-image'] !== undefined && !values['smoke-image'].trim()) throw new Error('Empty smoke image');
    if (values.help) process.stdout.write('Usage: node examples/pnpm/verify.js [--smoke-image <local-image>]\nRequires pnpm 11.23.0 on PATH or PNPM_CLI. Offline synthetic workspace; application execution only in explicit constrained smoke.\n');
    else {
      const report = await runPnpmExample({ smokeImage: values['smoke-image'] });
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`); process.exitCode = exampleExitCode(report);
    }
  } catch {
    process.stdout.write(`${JSON.stringify({ execution: 'invalid_input', passed: false, reason: 'invalid_arguments' })}\n`); process.exitCode = 2;
  }
}
