import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const reader = await import('../src/read.js').catch(() => null);

test('the bounded reader rejects a source larger than its remaining budget without returning its contents', async () => {
  assert.equal(typeof reader?.readBounded, 'function', 'bounded source reader is required');
  const root = await mkdtemp(join(tmpdir(), 'deployproof-reader-'));
  try {
    const path = join(root, 'source.js'); await writeFile(path, '0123456789');
    await assert.rejects(reader.readBounded(path, 4), { code: 'READ_LIMIT' });
    assert.equal((await reader.readBounded(path, 10)).toString(), '0123456789');
  } finally { await rm(root, { recursive: true, force: true }); }
});
