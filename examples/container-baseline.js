// Deliberately separate handwritten container baseline, only for the synthetic benchmark fixture.
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { containerClientConfiguration } from '../src/container-client.js';

export function containerBaseline(directory, image = 'node:22-alpine') {
  const started = performance.now(), name = 'deployproof-baseline-' + randomUUID(), stage = name + '-stage';
  const report = { status: 'blocked', cleanup: 'not_required', exitCode: null, durationMs: 0 };
  const call = (args, timeout = 8000) => {
    const client = containerClientConfiguration();
    const r = spawnSync(client.executable, args, { env: client.env, encoding: 'utf8', timeout, maxBuffer: 65536, shell: false });
    if (r.error || r.status !== 0) throw new Error('Container client prerequisite or operation unavailable');
    return r.stdout.trim();
  };
  let imageId;
  try {
    call(['info', '--format', '{{.ServerVersion}}']);
    imageId = call(['image', 'inspect', image, '--format', '{{.Id}}']);
    if (!/^sha256:[a-f0-9]{64}$/.test(imageId)) throw new Error();
    report.imageId = imageId;
  } catch {
    report.reason = 'Container engine or the selected local image is unavailable.'; report.durationMs = Math.round(performance.now() - started); return report;
  }
  const containers = [];
  let snapshot, commitAttempted = false;
  const labels = ['--label', 'com.deployproof.owner=benchmark', '--label', 'com.deployproof.run=' + name];
  const constraints = ['--init', '--network', 'none', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--user', '10001:10001', '--memory', '256m', '--cpus', '0.5', '--pids-limit', '64', '--log-driver', 'none', '--workdir', '/artifact', '--entrypoint', 'node'];
  try {
    report.status = 'error';
    containers.push(stage);
    call(['create', '--name', stage, ...labels, ...constraints, imageId, 'server.js']);
    call(['cp', directory + '/.', stage + ':/artifact'], 30000);
    commitAttempted = true;
    snapshot = call(['commit', stage], 30000);
    if (!/^sha256:[a-f0-9]{64}$/.test(snapshot)) { snapshot = undefined; throw new Error(); }
    report.artifactImageId = snapshot;
    containers.push(name);
    call(['create', '--name', name, ...labels, '--read-only', ...constraints, snapshot, 'server.js']);
    call(['start', name]);
    const value = call(['wait', name], 15000);
    if (!/^\d{1,3}$/.test(value)) throw new Error();
    const state = JSON.parse(call(['inspect', '--format', '{{json .State}}', name]));
    if (state?.Running !== false || state?.OOMKilled !== false || state?.ExitCode !== Number(value)) throw new Error();
    report.exitCode = Number(value); report.status = report.exitCode === 0 ? 'passed' : 'failed';
  } catch { report.status = 'error'; }
  finally {
    let clean = true;
    const owned = metadata => metadata?.['com.deployproof.owner'] === 'benchmark' && metadata?.['com.deployproof.run'] === name;
    for (const container of containers.reverse()) {
      try {
        if (!owned(JSON.parse(call(['inspect', '--format', '{{json .Config.Labels}}', container])))) throw new Error();
        call(['rm', '--force', container]);
      } catch { clean = false; }
    }
    if (snapshot) {
      try {
        if (!owned(JSON.parse(call(['image', 'inspect', '--format', '{{json .Config.Labels}}', snapshot])))) throw new Error();
        call(['image', 'rm', snapshot]);
      } catch { clean = false; }
    } else if (commitAttempted) clean = false;
    report.cleanup = clean ? 'completed' : 'failed';
    if (!clean) report.status = 'error';
  }
  report.durationMs = Math.round(performance.now() - started); return report;
}
