import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { realpath, lstat } from 'node:fs/promises';
import { containerClientConfiguration } from './container-client.js';

function docker(binary, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const client = containerClientConfiguration(binary);
    const child = spawn(client.executable, args, { env: client.env, shell: false, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    let stdout = '', bytes = 0, stopped = false;
    const stop = () => { try { if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch {} };
    const timer = setTimeout(() => { stopped = true; stop(); }, timeoutMs);
    child.stdout.on('data', chunk => { bytes += chunk.length; if (bytes > 65_536) { stopped = true; stop(); } else stdout += chunk; });
    child.stderr.on('data', chunk => { bytes += chunk.length; if (bytes > 65_536) { stopped = true; stop(); } });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => { clearTimeout(timer); if (stopped) reject(new Error('Container client operation timed out or exceeded output limit')); else if (code !== 0) reject(new Error('Container client operation failed')); else resolve(stdout.trim()); });
  });
}

/** Explicit, bounded container command. Inspected application code never executes on the host. */
export async function smokeArtifact(directory, options = {}) {
  const started = performance.now();
  const result = { status: 'error', cleanup: 'not_required', exitCode: null, durationMs: 0, reason: '' };
  const finish = () => { result.durationMs = Math.round((performance.now() - started) * 100) / 100; return result; };
  const { image, command } = options;
  const timeoutMs = options.timeoutMs ?? 15_000;
  if (typeof image !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_./:@-]{0,250}$/.test(image) || !Array.isArray(command) || !command.length || command.some(x => typeof x !== 'string' || !x || x.includes('\0')) || !Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120_000) {
    result.reason = 'An image, an explicit argv command, and a timeout from 100 to 120000 ms are required.'; return finish();
  }
  let artifact;
  try { artifact = await realpath(directory); if (!(await lstat(artifact)).isDirectory()) throw new Error(); }
  catch { result.reason = 'Artifact directory is unavailable.'; return finish(); }
  const call = (args, timeout = 8_000) => docker(options.dockerBinary, args, timeout);
  let imageId;
  try {
    await call(['info', '--format', '{{.ServerVersion}}']);
    imageId = await call(['image', 'inspect', image, '--format', '{{.Id}}']);
    if (!/^sha256:[a-f0-9]{64}$/.test(imageId)) throw new Error('Invalid image identity');
    result.imageId = imageId;
  } catch {
    result.status = 'blocked'; result.reason = 'Container engine or the selected local image is unavailable; no image is pulled automatically.'; return finish();
  }
  const runId = randomUUID(), name = 'deployproof-' + runId, stage = name + '-stage';
  const containers = [];
  let snapshot, commitAttempted = false, phase = 'staging';
  const labels = ['--label', 'com.deployproof.owner=deployproof', '--label', 'com.deployproof.run=' + runId];
  const constraints = ['--init', '--network', 'none', '--user', '10001:10001', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--pids-limit', '64', '--memory', '256m', '--cpus', '0.5', '--tmpfs', '/tmp:rw,noexec,nosuid,size=16m', '--log-driver', 'none', '--workdir', '/artifact'];
  try {
    // A read-only rootfs rejects docker cp. This container is never started: it only stages data.
    containers.push(stage);
    await call(['create', '--name', stage, ...labels, ...constraints, '--entrypoint', command[0], imageId, ...command.slice(1)]);
    phase = 'copy';
    await call(['cp', artifact + '/.', stage + ':/artifact'], 30_000);
    phase = 'snapshot';
    commitAttempted = true;
    snapshot = await call(['commit', stage], 30_000);
    if (!/^sha256:[a-f0-9]{64}$/.test(snapshot)) { snapshot = undefined; throw new Error('Invalid artifact snapshot identity'); }
    result.artifactImageId = snapshot;
    phase = 'execution';
    containers.push(name);
    await call(['create', '--name', name, ...labels, ...constraints, '--read-only', '--entrypoint', command[0], snapshot, ...command.slice(1)]);
    await call(['start', name]);
    const exit = await call(['wait', name], timeoutMs);
    if (!/^\d{1,3}$/.test(exit)) throw new Error('Invalid container exit observation');
    const state = JSON.parse(await call(['inspect', '--format', '{{json .State}}', name]));
    if (state?.Running !== false || state?.OOMKilled !== false || state?.ExitCode !== Number(exit)) throw new Error('Invalid terminal container state');
    result.exitCode = Number(exit); result.status = result.exitCode === 0 ? 'passed' : 'failed';
    result.reason = result.exitCode === 0 ? 'The explicit command exited zero in the isolated artifact snapshot.' : 'The explicit command exited nonzero in the isolated artifact snapshot.';
  } catch {
    result.status = 'error'; result.reason = 'Container ' + phase + ' failed, timed out, or returned an invalid observation.';
  } finally {
    let clean = true;
    const owned = metadata => metadata?.['com.deployproof.owner'] === 'deployproof' && metadata?.['com.deployproof.run'] === runId;
    for (const container of containers.reverse()) {
      try {
        if (!owned(JSON.parse(await call(['inspect', '--format', '{{json .Config.Labels}}', container])))) throw new Error('Ownership mismatch');
        await call(['rm', '--force', container]);
      } catch { clean = false; }
    }
    if (snapshot) {
      try {
        if (!owned(JSON.parse(await call(['image', 'inspect', '--format', '{{json .Config.Labels}}', snapshot])))) throw new Error('Ownership mismatch');
        await call(['image', 'rm', snapshot]);
      } catch { clean = false; }
    } else if (commitAttempted) clean = false;
    result.cleanup = clean ? 'completed' : 'failed';
    if (!clean) { result.status = 'error'; result.reason = 'Scoped container/snapshot cleanup could not be verified; the result cannot pass.'; }
  }
  return finish();
}
