import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { smokeArtifact } from '../src/index.js';
import { createFixtures } from '../examples/fixtures.js';
const temporary = await mkdtemp(join(tmpdir(), 'deployproof-integration-'));
try {
  const fixtures = await createFixtures(join(temporary, 'fixtures'));
  for (const item of fixtures.cases) {
    const result = await smokeArtifact(item.directory, { image: 'node:22-alpine', command: ['node', 'server.js'] });
    if (result.status === 'blocked') { process.stderr.write(`BLOCKED real-container gate: ${result.reason}\n`); process.exitCode = 2; break; }
    assert.equal(result.cleanup, 'completed');
    assert.equal(result.status, item.expected === 'passed' ? 'passed' : 'failed', item.name);
  }
  if (!process.exitCode) process.stdout.write('PASS: six real-container broken/fixed artifact smoke cases.\n');
} finally { await rm(temporary, { recursive: true, force: true }); }
