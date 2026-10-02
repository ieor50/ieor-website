import { list, get } from '@vercel/blob';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Set BLOB_READ_WRITE_TOKEN for the private review store.');
const directory = resolve(process.argv[2] || '.review-data');
await mkdir(directory, { recursive: true, mode: 0o700 });
const records = [];
let cursor;
do {
  const page = await list({ prefix: 'ieor-reviews/', cursor });
  for (const blob of page.blobs) {
    const result = await get(blob.pathname, { access: 'private', useCache: false });
    if (!result || result.statusCode !== 200) throw new Error(`Cannot retrieve ${blob.pathname}`);
    records.push(await new Response(result.stream).json());
  }
  cursor = page.hasMore ? page.cursor : undefined;
} while (cursor);
records.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
const output = join(directory, `ieor-reviews-${new Date().toISOString().replaceAll(':', '-')}.json`);
await writeFile(output, JSON.stringify(records, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
console.log(`Exported ${records.length} reviews to ${output}`);
