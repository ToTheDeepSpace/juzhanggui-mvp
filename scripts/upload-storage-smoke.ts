import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { SanitizedUploadImage } from '../api/uploadSecurity.js';

const storage = await import('../api/uploadStorage.js').catch(() => null);
assert.ok(storage, 'uploadStorage module should exist');
assert.equal(typeof storage.saveSanitizedUploadImage, 'function');

const image: SanitizedUploadImage = {
  buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
  ext: 'jpg',
  contentType: 'image/jpeg',
  width: 1,
  height: 1,
};

const localRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'jzg-upload-storage-'));
const fixedNow = new Date('2026-06-23T03:00:00.000Z');

const localResult = await storage.saveSanitizedUploadImage(image, 'rooms', {
  env: {},
  localUploadRoot: localRoot,
  now: fixedNow,
  randomId: () => 'local-id',
});

assert.deepEqual(localResult, {
  storage: 'local',
  url: '/api/uploads/rooms/2026-06-23/local-id.jpg',
  relativePath: 'rooms/2026-06-23/local-id.jpg',
});
assert.deepEqual(
  await fs.readFile(path.join(localRoot, 'rooms', '2026-06-23', 'local-id.jpg')),
  image.buffer,
);

const putCalls: Array<{ key: string; body: Buffer; contentType: string }> = [];
const cosResult = await storage.saveSanitizedUploadImage(image, 'actors', {
  env: {
    TENCENT_COS_SECRET_ID: 'AKID_TEST',
    TENCENT_COS_SECRET_KEY: 'secret',
    TENCENT_COS_BUCKET: 'jusichen-prod-assets-1434761838',
    TENCENT_COS_REGION: 'ap-nanjing',
    TENCENT_COS_UPLOAD_PREFIX: 'juzhanggui/uploads',
  },
  localUploadRoot: localRoot,
  now: fixedNow,
  randomId: () => 'cos-id',
  cosTransport: {
    putObject: async (input: { key: string; body: Buffer; contentType: string }) => {
      putCalls.push(input);
    },
  },
});

assert.deepEqual(cosResult, {
  storage: 'cos',
  url: '/api/uploads/actors/2026-06-23/cos-id.jpg',
  relativePath: 'actors/2026-06-23/cos-id.jpg',
  key: 'juzhanggui/uploads/actors/2026-06-23/cos-id.jpg',
});
assert.equal(putCalls.length, 1);
assert.equal(putCalls[0].key, 'juzhanggui/uploads/actors/2026-06-23/cos-id.jpg');
assert.equal(putCalls[0].contentType, 'image/jpeg');
assert.deepEqual(putCalls[0].body, image.buffer);
await assert.rejects(
  () => fs.stat(path.join(localRoot, 'actors', '2026-06-23', 'cos-id.jpg')),
  /ENOENT/,
);

assert.equal(storage.normalizeUploadRelativePath('/rooms/2026-06-23/a.jpg'), 'rooms/2026-06-23/a.jpg');
assert.equal(storage.normalizeUploadRelativePath('../secret.env'), null);
assert.equal(storage.normalizeUploadRelativePath('rooms/../../secret.env'), null);

console.log('upload storage smoke passed');
