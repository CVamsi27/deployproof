#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { checkArtifact, exitCode, smokeArtifact } from './index.js';
import { runDemo } from './demo.js';

const usage = 'Usage: deployproof check <artifact-dir> --entry <relative.js> [--json] [--smoke-image <local-image> -- <command> [args...]]\n       deployproof demo [--json]';
function printDiagnostics(report) {
  for (const d of report.diagnostics) process.stdout.write(`${d.code}: ${d.path ?? ''}${d.importer ? ` (from ${d.importer})` : ''}${d.specifier ? ` -> ${d.specifier}` : ''}\n  ${d.message}\n${d.chain ? `  chain: ${d.chain.join(' -> ')}\n` : ''}`);
}
try {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) { process.stdout.write(`${usage}\n`); }
  else if (args[0] === 'demo') {
    const { values } = parseArgs({ args: args.slice(1), strict: true, allowPositionals: false, options: { json: { type: 'boolean', default: false }, help: { type: 'boolean', short: 'h', default: false } } });
    if (values.help) process.stdout.write('Usage: deployproof demo [--json]\nInspect a private synthetic missing asset, repair it and remove the fixture. No application or container is executed.\n');
    else {
      const demo = await runDemo();
      if (values.json) process.stdout.write(`${JSON.stringify(demo, null, 2)}\n`);
      else {
        process.stdout.write('Synthetic demo: an entry reads message.txt, but the deployment folder omits it.\n');
        for (const step of demo.steps) {
          process.stdout.write(`${step.id === 'broken' ? 'Broken' : 'Fixed'} artifact: ${step.report.structural} (check exit ${step.observedExit})\n`);
          printDiagnostics(step.report);
        }
        process.stdout.write(`Cleanup: ${demo.cleanup}\nDemo: ${demo.passed ? 'passed' : 'incomplete'}\n`);
        if (demo.reason) process.stdout.write(`${demo.reason}\n`);
        process.stdout.write('Structural checks only; the synthetic application was not executed.\n');
      }
      process.exitCode = demo.passed ? 0 : 2;
    }
  }
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
      printDiagnostics(report);
      if (report.smoke.reason) process.stdout.write(`${report.smoke.reason}\n`);
      process.stdout.write('This result covers supported static patterns and the explicit smoke command only.\n');
    }
    process.exitCode = exitCode(report);
  }
} catch {
  process.stderr.write(`${usage}\nInvalid input or command execution failed.\n`); process.exitCode = 2;
}
