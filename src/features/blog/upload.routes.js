import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Sadece JPEG, PNG, WEBP, GIF kabul edilir'));
    }
    cb(null, true);
  },
});

const s3 = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT || 'http://atasa-minio:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || '',
    secretAccessKey: process.env.MINIO_SECRET_KEY || '',
  },
  forcePathStyle: true,
});

const BUCKET = process.env.MINIO_BLOG_BUCKET || 'blog-images';
const PUBLIC_URL = process.env.MINIO_PUBLIC_URL || 'https://cdn.atasa.mobi';

export function createUploadRouter() {
  const router = express.Router();

  router.post('/image', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'image alanı zorunlu' });

    const ext = (req.file.originalname.match(/\.[^.]+$/) || ['.jpg'])[0].toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.jpg';
    const date = new Date().toISOString().slice(0, 7);
    const key = `${date}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExt}`;

    try {
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
        CacheControl: 'public, max-age=31536000, immutable',
      }));
      const url = `${PUBLIC_URL}/${BUCKET}/${key}`;
      res.json({ success: true, url, key, size: req.file.size });
    } catch (err) {
      console.error('MinIO upload error:', err);
      res.status(500).json({ error: 'Yükleme başarısız', detail: String(err.message || err) });
    }
  });

  return router;
}
