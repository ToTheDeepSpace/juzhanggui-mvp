import sharp from 'sharp';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_INPUT_PIXELS = 16_000_000;
const MAX_OUTPUT_EDGE = 2400;

const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

export type SanitizedUploadImage = {
  buffer: Buffer;
  ext: 'jpg';
  contentType: 'image/jpeg';
  width: number;
  height: number;
};

function parseImageDataUrl(dataUrl: unknown) {
  const value = typeof dataUrl === 'string' ? dataUrl : '';
  const match = value.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match || !ALLOWED_MIME_TYPES.has(match[1])) throw new Error('请上传 png、jpg 或 webp 图片');
  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (!buffer.length) throw new Error('图片内容为空');
  if (buffer.length > MAX_UPLOAD_BYTES) throw new Error('图片不能超过 8MB');
  return { declaredType: match[1] === 'image/jpg' ? 'image/jpeg' : match[1], buffer };
}

function detectImageType(buffer: Buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

export async function sanitizeUploadedImageDataUrl(dataUrl: unknown): Promise<SanitizedUploadImage> {
  const { declaredType, buffer } = parseImageDataUrl(dataUrl);
  const actualType = detectImageType(buffer);
  if (!actualType || actualType !== declaredType) throw new Error('图片内容与类型不匹配');

  const image = sharp(buffer, {
    failOn: 'warning',
    limitInputPixels: MAX_INPUT_PIXELS,
  });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) throw new Error('无法读取图片尺寸');
  if ((metadata.pages || 1) > 1) throw new Error('暂不支持动图，请上传静态图片');

  const output = await image
    .rotate()
    .resize({
      width: MAX_OUTPUT_EDGE,
      height: MAX_OUTPUT_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: output.data,
    ext: 'jpg',
    contentType: 'image/jpeg',
    width: output.info.width,
    height: output.info.height,
  };
}
