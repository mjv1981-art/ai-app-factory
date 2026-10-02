import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { id, hash, invariant } from '../factory/policy.mjs';

export class Artifacts {
  constructor(store, config) {
    this.store = store; this.config = config;
    if (config.bucket) this.s3 = new S3Client({ region: config.region || 'auto', endpoint: config.endpoint,
      credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey }, forcePathStyle: true });
  }
  async put(owner, run, name, bytes, type = 'application/octet-stream') {
    invariant(bytes.length <= 15_000_000, 'Artifact exceeds size limit.');
    const item = { id: id(), runId: run.id, projectId: run.projectId, name, type, size: bytes.length, sha256: hash(bytes.toString('base64')), createdAt: new Date().toISOString() };
    if (this.s3) {
      item.key = `${owner}/${run.id}/${item.id}`;
      await this.s3.send(new PutObjectCommand({ Bucket: this.config.bucket, Key: item.key, Body: bytes, ContentType: type }));
    } else {
      // Small pilot evidence only; persistence remains PostgreSQL, never ephemeral local disk.
      const existing = await this.store.list('artifacts', owner);
      invariant(existing.reduce((n, a) => n + a.size, 0) + bytes.length <= 25_000_000, 'Pilot artifact quota exhausted; configure private object storage.', 409);
      item.base64 = bytes.toString('base64');
    }
    await this.store.put('artifacts', item, owner); return { ...item, base64: undefined, key: undefined };
  }
  async get(owner, key) {
    const item = await this.store.get('artifacts', key, owner);
    const bytes = item.key ? Buffer.from(await (await this.s3.send(new GetObjectCommand({ Bucket: this.config.bucket, Key: item.key }))).Body.transformToByteArray()) : Buffer.from(item.base64, 'base64');
    return { item, bytes };
  }
}
