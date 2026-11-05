import { lstat, readlink, readdir, realpath } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep, join } from 'node:path';
import { nodeFileTrace, resolve as nftResolve } from '@vercel/nft';
import { parse } from 'acorn';
import { readBounded } from './read.js';

const LIMITS = { maxFiles: 10_000, maxFileBytes: 2 * 1024 * 1024, maxReadBytes: 32 * 1024 * 1024, maxOperations: 100_000 };
const MISSING = new Set(['ENOENT', 'ENOTDIR']);
const clean = value => String(value).replace(/[\x00-\x1f\x7f]/g, '').slice(0, 400);
const missing = error => MISSING.has(error?.code);
function inside(root, path) { const r = relative(root, path); return r === '' || (!isAbsolute(r) && r !== '..' && !r.startsWith(`..${sep}`)); }
const literal = n => n?.type === 'Literal' && typeof n.value === 'string' ? n.value : null;
function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) { for (const child of value) if (child?.type) walk(child, visit); }
    else if (value?.type) walk(value, visit);
  }
}

/** Read-only analysis. It never imports, requires or starts the inspected application. */
export async function checkArtifact(directory, options = {}) {
  const started = performance.now();
  const report = { schemaVersion: 1, execution: 'completed', structural: 'not_evaluated', coverage: 'partial', diagnostics: [], filesTraced: 0, smoke: { status: 'not_run' }, durationMs: 0 };
  const finish = () => { for (const item of report.diagnostics) { for (const [key, value] of Object.entries(item)) { if (typeof value === 'string') item[key] = clean(value); else if (Array.isArray(value)) item[key] = value.map(clean); } } report.durationMs = Math.round((performance.now() - started) * 100) / 100; return report; };
  const entry = options.entry;
  const limits = { ...LIMITS, ...Object.fromEntries(Object.keys(LIMITS).filter(k => options[k] !== undefined).map(k => [k, options[k]])) };
  if (typeof directory !== 'string' || !directory || typeof entry !== 'string' || !entry || isAbsolute(entry) || entry.split(/[\\/]/).includes('..') || !['.js', '.mjs', '.cjs'].includes(extname(entry)) || Object.values(limits).some(n => !Number.isSafeInteger(n) || n < 1)) {
    report.execution = 'invalid_input'; report.diagnostics.push({ code: 'invalid_input', severity: 'error', message: 'Choose an artifact directory, a contained .js/.mjs/.cjs entry, and positive integer limits.' }); return finish();
  }
  let root;
  try { root = await realpath(directory); if (!(await lstat(root)).isDirectory()) throw new Error('Not a directory'); }
  catch { report.execution = 'invalid_input'; report.diagnostics.push({ code: 'invalid_input', severity: 'error', message: 'Artifact directory is unavailable or is not a directory.' }); return finish(); }
  const display = p => clean(inside(root, p) ? relative(root, p).split(sep).join('/') || '.' : '<outside-artifact>');
  const unique = new Set();
  let partial = false, operations = 0, readBytes = 0;
  const files = [], contents = new Map();
  const add = (code, path, message, fields = {}, severity = 'finding') => {
    const item = { code, severity, path: display(path), message, ...fields };
    const key = JSON.stringify(item); if (!unique.has(key) && report.diagnostics.length < 1000) { unique.add(key); report.diagnostics.push(item); }
    if (severity === 'incomplete') partial = true;
  };
  const operation = () => { if (++operations > limits.maxOperations) throw new Error('operation_limit'); };
  // Resolve one component at a time: external links are rejected BEFORE the target is inspected.
  async function safePath(path, seen = new Set()) {
    operation();
    if (!inside(root, path)) return null;
    const parts = relative(root, path).split(sep).filter(Boolean);
    let at = root;
    for (let index = 0; index < parts.length; index++) {
      at = join(at, parts[index]);
      let st;
      try { st = await lstat(at); } catch (error) { if (missing(error)) return null; throw error; }
      if (!st.isSymbolicLink()) continue;
      if (seen.has(at) || seen.size >= 40) { add('symlink_cycle', at, 'Symlink cycle prevents this artifact from being portable.'); return null; }
      seen.add(at);
      const target = resolve(dirname(at), await readlink(at));
      if (!inside(root, target)) { add('external_symlink', at, 'Symlink points outside the deployment folder; the target was not read.'); return null; }
      const result = await safePath(join(target, ...parts.slice(index + 1)), seen);
      if (result === null && !report.diagnostics.some(d => d.path === display(at) && ['symlink_cycle', 'external_symlink'].includes(d.code))) add('dangling_symlink', at, 'Symlink target is unavailable inside the deployment folder.');
      return result;
    }
    return at;
  }
  async function scan(path) {
    operation();
    const entries = await readdir(path, { withFileTypes: true });
    for (const item of entries) {
      if (files.length >= limits.maxFiles) { add('scan_limit', path, 'File-count limit reached; this is an incomplete scan.', {}, 'incomplete'); return; }
      const full = join(path, item.name); files.push(full);
      if (item.isSymbolicLink()) await safePath(full);
      else if (item.isDirectory()) await scan(full);
      else if (!item.isFile()) add('unsupported_file', full, 'Special filesystem object is not supported.', {}, 'incomplete');
    }
  }
  async function boundedRead(path) {
    operation(); const actual = await safePath(path); if (!actual) return null;
    if (contents.has(actual)) return contents.get(actual);
    const st = await lstat(actual); if (!st.isFile()) return null;
    if (st.size > limits.maxFileBytes || readBytes + st.size > limits.maxReadBytes) {
      add('read_limit', actual, 'Source read limit reached; this is an incomplete trace.', {}, 'incomplete'); return null;
    }
    let body;
    try { body = await readBounded(actual, Math.min(limits.maxFileBytes, limits.maxReadBytes - readBytes)); }
    catch (error) { if (error.code !== 'READ_LIMIT') throw error; add('read_limit', actual, 'File grew beyond the read limit.', {}, 'incomplete'); return null; }
    if (!body) return null;
    readBytes += body.length;
    if (body.length > limits.maxFileBytes || readBytes > limits.maxReadBytes) { add('read_limit', actual, 'File grew beyond the read limit.', {}, 'incomplete'); return null; }
    contents.set(actual, body); return body;
  }
  try {
    await scan(root);
    const initial = resolve(root, entry), actualEntry = await safePath(initial);
    if (!actualEntry || !(await lstat(actualEntry)).isFile()) {
      add('missing_entry', initial, 'Declared entry is missing or does not resolve to a contained regular file.'); report.structural = 'failed'; return finish();
    }
    const resolutionFailures = [];
    const trace = await nodeFileTrace([initial], {
      base: root, processCwd: root, ts: false, analysis: { emitGlobs: false }, fileIOConcurrency: 8,
      readFile: boundedRead,
      stat: async path => { operation(); const actual = await safePath(path); return actual ? lstat(actual) : null; },
      readlink: async path => {
        operation(); if (!inside(root, path) || !(await safePath(dirname(path)))) return null;
        try { return (await lstat(path)).isSymbolicLink() ? readlink(path) : null; } catch (error) { if (missing(error)) return null; throw error; }
      },
      resolve: async (specifier, parent, job, cjsResolve) => {
        try { return await nftResolve(specifier, parent, job, cjsResolve); }
        catch (error) { resolutionFailures.push({ specifier: clean(specifier), importer: display(parent) }); throw error; }
      },
    });
    report.filesTraced = trace.fileList.size;
    const parents = new Map([...trace.reasons].map(([path, reason]) => [path, [...reason.parents].sort()]));
    function chainFor(path, seen = new Set()) {
      if (seen.has(path) || seen.size > 30) return [path]; seen.add(path);
      const parent = parents.get(path)?.[0]; return parent ? [...chainFor(parent, seen), path] : [path];
    }
    for (const failure of resolutionFailures) {
      add('missing_dependency', resolve(root, failure.importer), 'Dependency cannot be resolved from the deployment folder.', { ...failure, chain: [...chainFor(failure.importer), failure.specifier] });
    }
    if (trace.warnings.size > 0) add('trace_warning', initial, 'Node File Trace reported unsupported or unparseable behavior; inspect the source with your normal build tools.', {}, 'incomplete');
    for (const traced of trace.fileList) {
      if (!['.js', '.mjs', '.cjs'].includes(extname(traced))) continue;
      const full = resolve(root, traced); const body = await boundedRead(full); if (!body) continue;
      let ast;
      try { ast = parse(body.toString('utf8'), { ecmaVersion: 'latest', sourceType: 'module', allowReturnOutsideFunction: true }); }
      catch { add('unsupported_syntax', full, 'Supplemental literal-asset inspection cannot parse this module.', {}, 'incomplete'); continue; }
      const fsNames = new Set(), fsObjects = new Set(), assetChecks = [];
      walk(ast, node => {
        if (node.type === 'ImportDeclaration' && ['fs', 'node:fs', 'fs/promises', 'node:fs/promises'].includes(literal(node.source))) {
          for (const item of node.specifiers) {
            if (item.type === 'ImportSpecifier' && ['readFile', 'readFileSync', 'createReadStream', 'open', 'openSync'].includes(item.imported.name)) fsNames.add(item.local.name);
            else if (item.type !== 'ImportSpecifier') fsObjects.add(item.local.name);
          }
        }
        if (node.type === 'VariableDeclarator' && node.init?.type === 'CallExpression' && node.init.callee?.name === 'require' && ['fs', 'node:fs', 'fs/promises', 'node:fs/promises'].includes(literal(node.init.arguments[0]))) {
          if (node.id.type === 'Identifier') fsObjects.add(node.id.name);
          else if (node.id.type === 'ObjectPattern') for (const property of node.id.properties) if (['readFile', 'readFileSync', 'createReadStream', 'open', 'openSync'].includes(property.key?.name)) fsNames.add(property.value.name);
        }
        if ((node.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === 'require') || node.type === 'ImportExpression') {
          const arg = node.type === 'ImportExpression' ? node.source : node.arguments[0];
          if (literal(arg) === null) add('dynamic_dependency', full, 'Runtime-computed module loading is outside the supported static check.', { importer: traced }, 'incomplete');
        }
      });
      walk(ast, node => {
        if (node.type !== 'CallExpression') return;
        const call = node.callee;
        const fsCall = call.type === 'Identifier' && fsNames.has(call.name) || call.type === 'MemberExpression' && (fsObjects.has(call.object?.name) || call.object?.type === 'MemberExpression' && call.object.property?.name === 'promises' && fsObjects.has(call.object.object?.name)) && ['readFile', 'readFileSync', 'createReadStream', 'open', 'openSync'].includes(call.property?.name);
        if (!fsCall) return;
        const arg = node.arguments[0]; let path;
        if (arg?.type === 'NewExpression' && arg.callee?.name === 'URL' && literal(arg.arguments[0]) !== null && arg.arguments[1]?.type === 'MemberExpression' && arg.arguments[1].object?.type === 'MetaProperty') {
          path = resolve(dirname(full), literal(arg.arguments[0]));
        } else if (literal(arg) !== null && !isAbsolute(literal(arg))) path = resolve(root, literal(arg));
        if (!path) { add('dynamic_asset', full, 'Filesystem path is not a supported literal or import.meta.url-relative URL.', { importer: traced }, 'incomplete'); return; }
        assetChecks.push(path);
      });
      for (const path of assetChecks) {
        if (!inside(root, path)) add('external_asset', full, 'A literal asset path resolves outside the deployment folder.', { importer: traced });
        else if (!await safePath(path)) add('missing_asset', path, 'Literal runtime asset is absent from the deployment folder.', { importer: traced, chain: [...chainFor(traced), display(path)] });
      }
    }
    report.structural = report.diagnostics.some(d => d.severity === 'finding') ? 'failed' : partial ? 'not_evaluated' : 'passed';
    report.coverage = partial ? 'partial' : 'complete_for_supported_static_patterns';
  } catch (error) {
    if (error.message === 'operation_limit') { add('operation_limit', root, 'Filesystem operation limit reached.', {}, 'incomplete'); report.structural = report.diagnostics.some(d => d.severity === 'finding') ? 'failed' : 'not_evaluated'; }
    else { report.execution = 'tool_error'; report.structural = 'not_evaluated'; add('tool_error', root, 'Analysis failed; no complete result is available.', {}, 'incomplete'); }
  }
  return finish();
}

export function exitCode(report) {
  if (report.execution !== 'completed' || report.smoke?.cleanup === 'failed' || report.smoke?.status === 'blocked' || report.smoke?.status === 'error') return 2;
  if (report.structural === 'failed' || report.smoke?.status === 'failed') return 1;
  if (report.coverage === 'partial' || report.structural !== 'passed') return 3;
  return 0;
}
