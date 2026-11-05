import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkArtifact, exitCode } from './check.js';

// A real negative control followed by its repair. The entry is read, never run.
export async function runDemo() {
  const result = { schemaVersion: 1, example: 'missing-runtime-asset', execution: 'failed', cleanup: 'completed', passed: false, steps: [] };
  let directory;
  try {
    directory = await mkdtemp(join(tmpdir(), 'deployproof-demo-cell-'));
    await writeFile(join(directory, 'package.json'), '{"type":"module"}\n');
    await writeFile(join(directory, 'server.js'), "import { readFileSync } from 'node:fs';\nreadFileSync(new URL('./message.txt', import.meta.url));\nthrow new Error('Synthetic demo entry must not execute');\n");
    const broken = await checkArtifact(directory, { entry: 'server.js' });
    result.steps.push({ id: 'broken', expectedExit: 1, observedExit: exitCode(broken), report: broken });
    await writeFile(join(directory, 'message.txt'), 'Synthetic deployment asset.\n');
    const fixed = await checkArtifact(directory, { entry: 'server.js' });
    result.steps.push({ id: 'fixed', expectedExit: 0, observedExit: exitCode(fixed), report: fixed });
    result.execution = 'completed';
  } catch {
    result.reason = 'The synthetic demo could not complete; no complete result is available.';
  } finally {
    if (directory) {
      try { await rm(directory, { recursive: true, force: true }); }
      catch { result.cleanup = 'failed'; result.reason = 'The private synthetic directory could not be removed.'; }
    }
  }
  const [broken, fixed] = result.steps;
  result.passed = result.execution === 'completed' && result.cleanup === 'completed'
    && broken?.observedExit === 1 && fixed?.observedExit === 0
    && broken.report.diagnostics.some(item => item.code === 'missing_asset' && item.path === 'message.txt'
      && item.chain?.join(' -> ') === 'server.js -> message.txt')
    && result.steps.every(step => step.report.execution === 'completed'
      && step.report.coverage === 'complete_for_supported_static_patterns' && step.report.smoke.status === 'not_run');
  if (!result.passed && !result.reason) result.reason = 'The observed broken/fixed results did not match the demo controls.';
  return result;
}
