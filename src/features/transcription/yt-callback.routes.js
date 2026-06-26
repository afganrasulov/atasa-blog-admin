// Webhook receiver: GitHub Actions runner POSTs job result here.
// Signature: HMAC-SHA256(body, YT_WEBHOOK_SECRET) in X-Webhook-Signature.

import express from 'express';
import crypto from 'crypto';
import { pool } from '../../shared/database.js';

export function createYtCallbackRouter() {
  const router = express.Router();
  const SECRET = process.env.YT_WEBHOOK_SECRET || '';

  // We need raw body for HMAC verification; mount json parser with verify hook.
  router.post(
    '/download-callback',
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf.toString('utf8');
      },
    }),
    async (req, res) => {
      if (!SECRET) return res.status(503).json({ error: 'webhook not configured' });

      const sigHeader = req.header('X-Webhook-Signature') || '';
      const provided = sigHeader.replace(/^sha256=/, '');
      const expected = crypto.createHmac('sha256', SECRET).update(req.rawBody || '').digest('hex');

      if (
        provided.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
      ) {
        return res.status(401).json({ error: 'invalid signature' });
      }

      const { status, job_id, video_id, audio_url, key, size_bytes, error } = req.body;
      if (!job_id) return res.status(400).json({ error: 'job_id required' });

      try {
        if (status === 'done') {
          await pool.query(
            `UPDATE yt_jobs SET status='done', audio_url=$1, key=$2, size_bytes=$3, completed_at=NOW()
             WHERE id=$4`,
            [audio_url, key || null, size_bytes || null, job_id],
          );
          if (video_id && audio_url) {
            await pool.query(
              `UPDATE youtube_videos SET audio_url=$1, audio_status='ready' WHERE id=$2`,
              [audio_url, video_id],
            );
          }
          console.log(`✅ YT job ${job_id} done: ${audio_url}`);
        } else if (status === 'failed') {
          await pool.query(
            `UPDATE yt_jobs SET status='failed', error_message=$1, completed_at=NOW() WHERE id=$2`,
            [error || 'unknown', job_id],
          );
          console.log(`❌ YT job ${job_id} failed: ${error}`);
        } else {
          return res.status(400).json({ error: 'unknown status' });
        }
        res.json({ ok: true });
      } catch (e) {
        console.error('yt-callback DB error:', e);
        res.status(500).json({ error: 'db error' });
      }
    },
  );

  return router;
}
