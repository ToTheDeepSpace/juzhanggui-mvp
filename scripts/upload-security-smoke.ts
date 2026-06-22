import assert from 'node:assert/strict';
import sharp from 'sharp';
import { sanitizeUploadedImageDataUrl } from '../api/uploadSecurity';

const onePixelPng = await sharp({
  create: {
    width: 1,
    height: 1,
    channels: 3,
    background: '#ffffff',
  },
}).png().toBuffer();
const pngWithTrailingPayload = Buffer.concat([onePixelPng, Buffer.from('<script>alert(1)</script>')]).toString('base64');

const sanitized = await sanitizeUploadedImageDataUrl(`data:image/png;base64,${pngWithTrailingPayload}`);
assert.equal(sanitized.contentType, 'image/jpeg');
assert.equal(sanitized.ext, 'jpg');
assert.equal(sanitized.buffer[0], 0xff);
assert.equal(sanitized.buffer[1], 0xd8);
assert.equal(sanitized.buffer.includes(Buffer.from('<script>')), false, 'sanitized output must not retain trailing payload');

await assert.rejects(
  () => sanitizeUploadedImageDataUrl(`data:image/png;base64,${Buffer.from('<svg><script>alert(1)</script></svg>').toString('base64')}`),
  /图片内容与类型不匹配|请上传/,
);

await assert.rejects(
  () => sanitizeUploadedImageDataUrl(`data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}`),
  /请上传 png、jpg 或 webp 图片/,
);

console.log('upload security smoke passed');
