// 模拟对象存储（07 §5.1「craft publish」的上传目标；06 §7.4：一期 tita build 沿用 CLI 内置的 OSS 上传）。
// 假设：真实 OSS 用签名鉴权，这里只校验一个访问密钥头 x-oss-access-key；读公开。
// 对象按 <桶>/<键> 存在 <数据目录>/sim/oss/ 下，文件内容就是对象内容；同名对象已存在时返回 409（和 tita 的「已存在跳过」一致，由调用方决定跳过）。
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

export const OSS_ACCESS_KEY = 'sim-oss-access-key';

export class OssSim {
  constructor(private readonly root: string) {
    fs.mkdirSync(root, { recursive: true });
  }

  /** 对象在磁盘上的位置；键越界时返回 null */
  file(bucket: string, key: string): string | null {
    const base = path.resolve(this.root, bucket);
    const f = path.resolve(base, key);
    return f.startsWith(base + path.sep) ? f : null;
  }

  read(bucket: string, key: string): Buffer | null {
    const f = this.file(bucket, key);
    return f && fs.existsSync(f) && fs.statSync(f).isFile() ? fs.readFileSync(f) : null;
  }

  register(app: FastifyInstance): void {
    app.addContentTypeParser(
      'application/octet-stream',
      { parseAs: 'buffer', bodyLimit: 20 * 1024 * 1024 },
      (_req, body, done) => done(null, body),
    );
    // 假设：PUT /oss/<桶>/<键> 上传，头带 x-oss-access-key；返回内容的 sha256，调用方可核对
    app.put('/oss/:bucket/*', async (req, reply) => {
      if (req.headers['x-oss-access-key'] !== OSS_ACCESS_KEY)
        return reply.code(403).send({ Code: 'InvalidAccessKeyId' });
      const { bucket, '*': key } = req.params as { bucket: string; '*': string };
      const f = this.file(bucket, decodeURIComponent(key));
      if (!f) return reply.code(400).send({ Code: 'InvalidObjectName' });
      if (fs.existsSync(f)) return reply.code(409).send({ Code: 'FileAlreadyExists' });
      const body = req.body as Buffer;
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, body);
      return { sha256: crypto.createHash('sha256').update(body).digest('hex'), size: body.length };
    });
    app.get('/oss/:bucket/*', async (req, reply) => {
      const { bucket, '*': key } = req.params as { bucket: string; '*': string };
      const data = this.read(bucket, decodeURIComponent(key));
      if (!data) return reply.code(404).send({ Code: 'NoSuchKey' });
      return reply.type('application/octet-stream').send(data);
    });
    app.get('/__sim/oss', async () => ({ access_key: OSS_ACCESS_KEY }));
  }
}
