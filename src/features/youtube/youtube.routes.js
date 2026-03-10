import { Router } from 'express';
import { parseDuration } from '../../shared/helpers.js';

const YT_API = 'https://www.googleapis.com/youtube/v3';

export function youtubeRoutes(pool, getSetting) {
    const router = Router();

    // Get videos
    router.get('/videos', async (req, res) => {
        try {
            const { type } = req.query;
            let query = 'SELECT * FROM youtube_videos';
            let params = [];
            if (type) { query += ' WHERE video_type = $1'; params.push(type); }
            query += ' ORDER BY published_at DESC';
            res.json((await pool.query(query, params)).rows);
        } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
    });

    // Save videos
    router.post('/videos', async (req, res) => {
        try {
            const { videos } = req.body;
            if (!videos || !Array.isArray(videos)) return res.status(400).json({ error: 'Videos array required' });
            for (const video of videos) {
                await pool.query(
                    `INSERT INTO youtube_videos (id, title, description, thumbnail, duration, view_count, published_at, channel_id, video_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO UPDATE SET title = $2, description = $3, thumbnail = $4, duration = $5, view_count = $6, published_at = $7, video_type = $9, updated_at = CURRENT_TIMESTAMP`,
                    [video.id, video.title, video.description, video.thumbnail, video.duration, video.viewCount, video.publishedAt, video.channelId, video.type || 'video']
                );
            }
            res.json({ success: true, count: videos.length });
        } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
    });

    // Reclassify
    router.post('/videos/reclassify', async (req, res) => {
        try {
            const { videos } = req.body;
            if (!videos || !Array.isArray(videos)) return res.status(400).json({ error: 'Videos array required' });
            let updated = 0;
            for (const video of videos) {
                const result = await pool.query(`UPDATE youtube_videos SET video_type = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND video_type != $1`, [video.type, video.id]);
                if (result.rowCount > 0) updated++;
            }
            res.json({ success: true, updated, total: videos.length });
        } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
    });

    // Scan
    router.post('/scan', async (req, res) => {
        try {
            res.json({ success: true, message: 'Scan started' });
            // autoScanVideos is called from scheduler
        } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
    });

    // Get single video
    router.get('/videos/:id', async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM youtube_videos WHERE id = $1', [req.params.id]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Video not found' });
            res.json(result.rows[0]);
        } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
    });

    // Update transcript
    router.put('/videos/:id/transcript', async (req, res) => {
        try {
            const { transcript, model, status } = req.body;
            await pool.query(`UPDATE youtube_videos SET transcript = $1, transcript_model = $2, transcript_status = $3, transcript_updated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $4`, [transcript, model, status || 'completed', req.params.id]);
            res.json({ success: true });
        } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
    });

    // Update blog created
    router.put('/videos/:id/blog-created', async (req, res) => {
        try {
            const { blogPostId } = req.body;
            await pool.query(`UPDATE youtube_videos SET blog_created = TRUE, blog_post_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [blogPostId, req.params.id]);
            res.json({ success: true });
        } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
    });

    return router;
}
