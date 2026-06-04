// GitHub Actions-based YouTube audio downloader.
// Hetzner datacenter IPs are blocked by YouTube; GitHub Actions runners (Azure)
// are not. We dispatch a workflow_dispatch event, the runner downloads + uploads
// to MinIO, then POSTs back to /api/youtube/download-callback.

import { pool } from '../../shared/database.js';

const GITHUB_REPO = process.env.GITHUB_REPO || 'afganrasulov/atasa-blog-admin';
const GITHUB_TOKEN = process.env.GITHUB_DISPATCH_TOKEN;
const WORKFLOW_FILE = 'yt-audio-download.yml';
const CALLBACK_BASE = process.env.PUBLIC_BASE_URL || 'https://blog-admin.atasa.mobi';

export async function dispatchYouTubeDownload(videoId) {
  if (!GITHUB_TOKEN) throw new Error('GITHUB_DISPATCH_TOKEN env missing');

  const { rows } = await pool.query(
    `INSERT INTO yt_jobs (video_id, status) VALUES ($1, 'queued') RETURNING id`,
    [videoId],
  );
  const jobId = rows[0].id;

  const callbackUrl = `${CALLBACK_BASE}/api/youtube/download-callback`;
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
    {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: {
          video_id: videoId,
          job_id: jobId,
          callback_url: callbackUrl,
        },
      }),
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    await pool.query(
      `UPDATE yt_jobs SET status='failed', error_message=$1, completed_at=NOW() WHERE id=$2`,
      [`dispatch failed: HTTP ${res.status} — ${errText.slice(0, 300)}`, jobId],
    );
    throw new Error(`GitHub dispatch failed: ${res.status} ${errText}`);
  }

  console.log(`🎬 YouTube job dispatched: ${jobId} for ${videoId}`);
  return jobId;
}

export async function waitForJob(jobId, timeoutMs = 12 * 60 * 1000) {
  const start = Date.now();
  const pollEvery = 3000;
  while (Date.now() - start < timeoutMs) {
    const { rows } = await pool.query(
      `SELECT status, audio_url, error_message FROM yt_jobs WHERE id=$1`,
      [jobId],
    );
    if (rows.length === 0) throw new Error(`Job ${jobId} not found`);
    const job = rows[0];
    if (job.status === 'done') return job.audio_url;
    if (job.status === 'failed') throw new Error(job.error_message || 'YouTube job failed');
    await new Promise((r) => setTimeout(r, pollEvery));
  }
  await pool.query(
    `UPDATE yt_jobs SET status='failed', error_message='timeout', completed_at=NOW() WHERE id=$1 AND status NOT IN ('done','failed')`,
    [jobId],
  );
  throw new Error('YouTube job timeout — see GitHub Actions logs');
}

export async function downloadYouTubeAudio(videoId) {
  const jobId = await dispatchYouTubeDownload(videoId);
  return await waitForJob(jobId);
}
