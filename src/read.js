import { open } from 'node:fs/promises';
import { constants } from 'node:fs';

// Allocates at most the caller's remaining ceiling + 1, even if the file grows after stat.
export async function readBounded(path, maximum) {
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    if (!(await handle.stat()).isFile()) return null;
    const buffer = Buffer.alloc(maximum + 1);
    let total = 0;
    while (total < buffer.length) {
      const { bytesRead } = await handle.read(buffer, total, buffer.length - total, total);
      if (!bytesRead) break;
      total += bytesRead;
    }
    if (total > maximum) throw Object.assign(new Error('Source exceeds remaining read budget'), { code: 'READ_LIMIT' });
    return buffer.subarray(0, total);
  } finally { await handle.close(); }
}
