import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { runPnpmExample, exampleExitCode } from '../examples/pnpm/verify.js';

test('four actual pnpm artifacts match their real constrained smoke controls', async () => {
  const report = await runPnpmExample({ smokeImage: 'node:24-bookworm-slim' });
  assert.equal(report.passed, true, JSON.stringify(report));
  assert.equal(exampleExitCode(report), 0);
  assert.equal(report.cleanup, 'completed');
  assert.deepEqual(report.cases.map(item => item.report.smoke.status), ['passed', 'failed', 'failed', 'failed']);
  assert.ok(report.cases.every(item => item.report.smoke.cleanup === 'completed'));
});

test('a required but unavailable smoke image cannot pass the pnpm integration', async () => {
  const report = await runPnpmExample({ smokeImage: `deployproof-missing-${randomUUID()}:local` });
  assert.equal(report.passed, false);
  assert.equal(exampleExitCode(report), 2);
  assert.equal(report.cleanup, 'completed');
  assert.equal(report.cases.length, 4);
  assert.ok(report.cases.every(item => item.report.smoke.status === 'blocked' && item.observedExit === 2));
});
