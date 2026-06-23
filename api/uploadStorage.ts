import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { SanitizedUploadImage } from './uploadSecurity.js';

type UploadEnv = Record<string, string | undefined>;

export type CosUploadConfig = {
  secretId: string;
  secretKey: string;
  bucket: string;
  region: string;
  uploadPrefix: string;
};

export type SaveSanitizedUploadOptions = {
  env?: UploadEnv;
  localUploadRoot: string;
  now?: Date;
  randomId?: () => string;
  cosTransport?: CosUploadTransport | null;
};

export type UploadSaveResult = {
  storage: 'local' | 'cos';
  url: string;
  relativePath: string;
  key?: string;
};

export type CosUploadTransport = {
  putObject(input: { key: string; body: Buffer; contentType: string }): Promise<void>;
  getObject?(key: string): Promise<CosGetObjectResult>;
};

export type CosGetObjectResult = {
  status: number;
  ok: boolean;
  body: Buffer;
  contentType: string;
  cacheControl: string;
};

function cleanEnv(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function trimSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, '');
}

export function getCosUploadConfig(env: UploadEnv = process.env): CosUploadConfig | null {
  const secretId = cleanEnv(env.TENCENT_COS_SECRET_ID);
  const secretKey = cleanEnv(env.TENCENT_COS_SECRET_KEY);
  const bucket = cleanEnv(env.TENCENT_COS_BUCKET);
  const region = cleanEnv(env.TENCENT_COS_REGION);
  const uploadPrefix = trimSlashes(cleanEnv(env.TENCENT_COS_UPLOAD_PREFIX || 'juzhanggui/uploads'));
  const values = [secretId, secretKey, bucket, region];
  if (values.every(Boolean)) return { secretId, secretKey, bucket, region, uploadPrefix };
  if (values.some(Boolean)) throw new Error('COS 上传配置不完整，请检查 TENCENT_COS_SECRET_ID / KEY / BUCKET / REGION');
  return null;
}

function cleanUploadFolder(folder: string) {
  return (folder || 'misc').replace(/[^a-z0-9/_-]/gi, '').replace(/^\/+|\/+$/g, '') || 'misc';
}

export function normalizeUploadRelativePath(input: unknown) {
  const value = String(input || '').replace(/^\/+/, '');
  if (!value || value.includes('\\') || value.length > 240) return null;
  if (!/^[a-z0-9/_\-.]+$/i.test(value)) return null;
  const segments = value.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) return null;
  if (path.posix.normalize(value) !== value) return null;
  return value;
}

export function buildCosObjectKey(config: CosUploadConfig, relativePath: string) {
  const normalized = normalizeUploadRelativePath(relativePath);
  if (!normalized) throw new Error('图片路径不合法');
  return `${trimSlashes(config.uploadPrefix)}/${normalized}`;
}

function buildUploadRelativePath(folder: string, ext: string, now: Date, id: string) {
  const safeFolder = cleanUploadFolder(folder);
  const day = now.toISOString().slice(0, 10);
  const safeId = id.replace(/[^a-z0-9-]/gi, '') || crypto.randomUUID();
  return `${safeFolder}/${day}/${safeId}.${ext}`;
}

export async function saveSanitizedUploadImage(
  image: SanitizedUploadImage,
  folder: string,
  options: SaveSanitizedUploadOptions,
): Promise<UploadSaveResult> {
  const relativePath = buildUploadRelativePath(
    folder,
    image.ext,
    options.now || new Date(),
    options.randomId ? options.randomId() : `${Date.now()}-${crypto.randomUUID()}`,
  );
  const url = `/api/uploads/${relativePath}`;
  const config = getCosUploadConfig(options.env);
  const transport = options.cosTransport ?? (config ? createTencentCosUploadTransport(config) : null);

  if (config && transport) {
    const key = buildCosObjectKey(config, relativePath);
    await transport.putObject({ key, body: image.buffer, contentType: image.contentType });
    return { storage: 'cos', url, relativePath, key };
  }

  const localPath = path.join(options.localUploadRoot, relativePath);
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, image.buffer, { mode: 0o644 });
  return { storage: 'local', url, relativePath };
}

function cosEncode(value: string) {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function createCosAuthorization(input: {
  method: string;
  pathname: string;
  headers: Record<string, string>;
  secretId: string;
  secretKey: string;
  now?: number;
}) {
  const now = input.now || Math.floor(Date.now() / 1000);
  const signTime = `${now};${now + 600}`;
  const headerPairs = Object.entries(input.headers)
    .map(([key, value]) => [cosEncode(key).toLowerCase(), cosEncode(String(value).trim())] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  const headerList = headerPairs.map(([key]) => key).join(';');
  const httpHeaders = headerPairs.map(([key, value]) => `${key}=${value}`).join('&');
  const httpString = `${input.method.toLowerCase()}\n${input.pathname}\n\n${httpHeaders}\n`;
  const httpStringSha1 = crypto.createHash('sha1').update(httpString).digest('hex');
  const stringToSign = `sha1\n${signTime}\n${httpStringSha1}\n`;
  const signKey = crypto.createHmac('sha1', input.secretKey).update(signTime).digest('hex');
  const signature = crypto.createHmac('sha1', signKey).update(stringToSign).digest('hex');
  return [
    'q-sign-algorithm=sha1',
    `q-ak=${input.secretId}`,
    `q-sign-time=${signTime}`,
    `q-key-time=${signTime}`,
    `q-header-list=${headerList}`,
    'q-url-param-list=',
    `q-signature=${signature}`,
  ].join('&');
}

function cosHost(config: CosUploadConfig) {
  return `${config.bucket}.cos.${config.region}.myqcloud.com`;
}

function cosPathname(key: string) {
  return `/${key.split('/').map(segment => encodeURIComponent(segment)).join('/')}`;
}

export function createTencentCosUploadTransport(config: CosUploadConfig): CosUploadTransport {
  const host = cosHost(config);
  async function request(method: string, key: string, body?: Buffer, contentType?: string): Promise<CosGetObjectResult> {
    const pathname = cosPathname(key);
    const signedHeaders: Record<string, string> = { host };
    const headers: Record<string, string> = { host };
    if (contentType) headers['content-type'] = contentType;
    if (body) {
      headers['content-length'] = String(body.length);
      headers['cache-control'] = 'public, max-age=31536000, immutable';
    }
    const authorization = createCosAuthorization({
      method,
      pathname,
      headers: signedHeaders,
      secretId: config.secretId,
      secretKey: config.secretKey,
    });
    const response = await fetch(`https://${host}${pathname}`, {
      method,
      headers: { ...headers, Authorization: authorization },
      body: body ? new Uint8Array(body) : undefined,
    });
    const responseBody = Buffer.from(await response.arrayBuffer());
    return {
      status: response.status,
      ok: response.ok,
      body: responseBody,
      contentType: response.headers.get('content-type') || contentType || 'application/octet-stream',
      cacheControl: response.headers.get('cache-control') || 'public, max-age=31536000, immutable',
    };
  }

  return {
    async putObject(input) {
      const result = await request('PUT', input.key, input.body, input.contentType);
      if (!result.ok) {
        const details = result.body.toString('utf8').slice(0, 300);
        throw new Error(`COS 上传失败：${result.status} ${details}`);
      }
    },
    async getObject(key) {
      return request('GET', key);
    },
  };
}
