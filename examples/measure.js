import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nodeFileTrace } from '@vercel/nft';
import { checkArtifact } from '../src/index.js';
import { createFixtures } from './fixtures.js';
import { containerBaseline } from './container-baseline.js';

const temporary = await mkdtemp(join(tmpdir(), 'deployproof-measure-'));
try {
  const { cases } = await createFixtures(join(temporary, 'fixtures'));
  const records = [];
  let dockerBlocked;
  for (const item of cases) {
    const started = performance.now();
    const raw = await nodeFileTrace([join(item.directory, item.entry)], { base: item.directory, processCwd: item.directory });
    const traceMs = Math.round((performance.now() - started) * 100) / 100;
    const report = await checkArtifact(item.directory, { entry: item.entry });
    const baseline = dockerBlocked ? { status: 'blocked', reason: dockerBlocked } : containerBaseline(item.directory);
    if (baseline.status === 'blocked') dockerBlocked = baseline.reason;
    records.push({ fixture: item.name, expected: item.expected, deployproof: { structural: report.structural, coverage: report.coverage, diagnosticCodes: report.diagnostics.map(d => d.code), durationMs: report.durationMs }, directNft: { fileCount: raw.fileList.size, warnings: raw.warnings.size, durationMs: traceMs, note: 'Direct NFT is a trace, not a pass/fail portability verdict. Synthetic external fixture files may be read by this baseline.' }, handwrittenContainer: baseline });
  }
  if (records.some(item => item.deployproof.structural !== item.expected)) process.exitCode = 1;
  else if (records.some(item => ['blocked', 'error'].includes(item.handwrittenContainer.status))) process.exitCode = 2;
  else if (records.some(item => item.handwrittenContainer.status !== item.expected || item.handwrittenContainer.cleanup !== 'completed')) process.exitCode = 1;
  process.stdout.write(`${JSON.stringify({ schemaVersion: 1, platform: process.platform, architecture: process.arch, node: process.version, repetitions: 1, records, adoption: 'unvalidated', conclusion: 'Synthetic detection and single-run timings only; no setup-time, productivity, or adoption advantage established.' }, null, 2)}\n`);
} finally { await rm(temporary, { recursive: true, force: true }); }
