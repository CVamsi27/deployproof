#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { checkArtifact, exitCode, smokeArtifact } from './index.js';

const usage = 'Usage: deployproof check <artifact-dir> --entry <relative.js> [--json] [--smoke-image <local-image> -- <command> [args...]]';
try {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) { process.stdout.write(`${usage}\n`); }
  else {
    const split = args.indexOf('--');
    const command = split < 0 ? [] : args.slice(split + 1);
    const { values, positionals } = parseArgs({ args: split < 0 ? args : args.slice(0, split), allowPositionals: true, strict: true, options: { entry: { type: 'string' }, json: { type: 'boolean', default: false }, 'smoke-image': { type: 'string' } } });
    if (positionals.length !== 2 || positionals[0] !== 'check' || !values.entry || Boolean(values['smoke-image']) !== Boolean(command.length)) throw new Error(usage);
    const report = await checkArtifact(positionals[1], { entry: values.entry });
    if (values['smoke-image'] && report.execution === 'completed') report.smoke = await smokeArtifact(positionals[1], { image: values['smoke-image'], command });
    if (values.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    else {
      process.stdout.write(`Structural: ${report.structural}\nCoverage: ${report.coverage}\nSmoke: ${report.smoke.status}\n`);
      for (const d of report.diagnostics) process.stdout.write(`${d.code}: ${d.path ?? ''}${d.importer ? ` (from ${d.importer})` : ''}${d.specifier ? ` -> ${d.specifier}` : ''}\n  ${d.message}\n${d.chain ? `  chain: ${d.chain.join(' -> ')}\n` : ''}`);
      if (report.smoke.reason) process.stdout.write(`${report.smoke.reason}\n`);
      process.stdout.write('This result covers supported static patterns and the explicit smoke command only.\n');
    }
    process.exitCode = exitCode(report);
  }
} catch {
  process.stderr.write(`${usage}\nInvalid input or command execution failed.\n`); process.exitCode = 2;
}
