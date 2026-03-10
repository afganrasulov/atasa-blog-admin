import { getSetting } from '../shared/helpers.js';
import { parseDuration } from '../shared/helpers.js';
import { cleanupAudioFiles } from '../features/transcription/audio-extractor.js';

const YT_API = 'https://www.googleapis.com/youtube/v3';

export function startScheduler(pool, transcriptionRouter) {
    // Check scheduled blog posts every minute
    setInterval(async () => {
        try {
            const result = await pool.query(
                `UPDATE blog_posts SET status = 'published', is_published = true, published_at = CURRENT_TIMESTAMP WHERE status = 'scheduled' AND scheduled_at <= CURRENT_TIMESTAMP RETURNING title`
            );
            result.rows.forEach(post => console.log(`📅 Published: ${post.title}`));
        } catch (error) { console.error('Schedule check error:', error); }
    }, 60000);

    // Check scheduled carousel posts every minute
    setInterval(async () => {
        try {
            const result = await pool.query(
                `SELECT sp.*, c.slides, t.ig_access_token, t.ig_user_id, t.default_hashtags
         FROM ig_scheduled_posts sp
         JOIN carousel_posts c ON sp.carousel_id = c.id
         JOIN ig_tenants t ON sp.tenant_id = t.id
         WHERE sp.status = 'pending' AND sp.scheduled_at <= NOW()`
            );
            for (const post of result.rows) {
                if (!post.ig_access_token || !post.ig_user_id) {
                    await pool.query(`UPDATE ig_scheduled_posts SET status = 'failed', error_message = 'Instagram not connected' WHERE id = $1`, [post.id]);
                    continue;
                }
                console.log(`📸 Publishing scheduled carousel ${post.carousel_id}...`);
            }
        } catch (error) { console.error('Scheduled post check error:', error); }
    }, 60000);

    // Auto scan videos
    setInterval(async () => {
        try {
            const autoScanEnabled = await getSetting('auto_scan_enabled');
            if (autoScanEnabled !== 'true') return;
            const lastScanTime = await getSetting('last_scan_time');
            const scanIntervalHours = parseInt(await getSetting('scan_interval_hours') || '6');
            if (lastScanTime) {
                const hoursSinceLastScan = (Date.now() - new Date(lastScanTime).getTime()) / (1000 * 60 * 60);
                if (hoursSinceLastScan < scanIntervalHours) return;
            }
            await autoScanVideos(pool, transcriptionRouter);
        } catch (error) { console.error('Auto-scan check error:', error); }
    }, 60 * 60 * 1000);

    // Cleanup old audio files every hour
    setInterval(cleanupAudioFiles, 60 * 60 * 1000);

    // Initial scan after 10 seconds
    setTimeout(() => { autoScanVideos(pool, transcriptionRouter); }, 10000);

    console.log('⏰ Scheduler started');
}

async function autoScanVideos(pool, transcriptionRouter) {
    try {
        const autoScanEnabled = await getSetting('auto_scan_enabled');
        if (autoScanEnabled !== 'true') return;
        const youtubeApiKey = await getSetting('youtube_api_key');
        const channelId = await getSetting('channel_id');
        if (!youtubeApiKey) { console.log('⚠️ Auto-scan skipped: No YouTube API key configured'); return; }
        console.log('🔄 Starting auto video scan...');
        let activeChannelId = channelId;
        if (!activeChannelId) {
            const ch = await fetch(`${YT_API}/search?part=snippet&type=channel&q=@atasa_tr&key=${youtubeApiKey}`).then(r => r.json());
            if (ch.items?.[0]) {
                activeChannelId = ch.items[0].snippet.channelId;
                await pool.query(`INSERT INTO settings (key, value) VALUES ('channel_id', $1) ON CONFLICT (key) DO UPDATE SET value = $1`, [activeChannelId]);
            }
        }
        if (!activeChannelId) { console.log('⚠️ Auto-scan failed: Could not determine channel ID'); return; }
        let allVideos = [], pageToken = null;
        for (let page = 0; page < 2; page++) {
            let searchUrl = `${YT_API}/search?part=snippet&channelId=${activeChannelId}&maxResults=50&order=date&type=video&key=${youtubeApiKey}`;
            if (pageToken) searchUrl += `&pageToken=${pageToken}`;
            const search = await fetch(searchUrl).then(r => r.json());
            if (!search.items?.length) break;
            const ids = search.items.map(i => i.id.videoId).join(',');
            const details = await fetch(`${YT_API}/videos?part=contentDetails,statistics&id=${ids}&key=${youtubeApiKey}`).then(r => r.json());
            const videos = search.items.map(i => {
                const d = details.items.find(x => x.id === i.id.videoId);
                const dur = parseDuration(d?.contentDetails?.duration || 'PT0S');
                return { id: i.id.videoId, title: i.snippet.title, description: i.snippet.description, thumbnail: i.snippet.thumbnails.high?.url, duration: dur, viewCount: parseInt(d?.statistics?.viewCount || 0), publishedAt: i.snippet.publishedAt, channelId: activeChannelId, type: dur <= 60 ? 'short' : 'video' };
            });
            allVideos = allVideos.concat(videos);
            pageToken = search.nextPageToken;
            if (!pageToken) break;
        }
        const existingIds = (await pool.query('SELECT id FROM youtube_videos')).rows.map(r => r.id);
        const newVideos = allVideos.filter(v => !existingIds.includes(v.id));
        if (newVideos.length === 0) {
            console.log('✅ Auto-scan complete: No new videos found');
            await pool.query(`INSERT INTO settings (key, value) VALUES ('last_scan_time', $1) ON CONFLICT (key) DO UPDATE SET value = $1`, [new Date().toISOString()]);
            return;
        }
        for (const video of newVideos) {
            await pool.query(`INSERT INTO youtube_videos (id, title, description, thumbnail, duration, view_count, published_at, channel_id, video_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`, [video.id, video.title, video.description, video.thumbnail, video.duration, video.viewCount, video.publishedAt, video.channelId, video.type]);
        }
        console.log(`✅ Auto-scan complete: ${newVideos.length} new videos found`);
        await pool.query(`INSERT INTO settings (key, value) VALUES ('last_scan_time', $1) ON CONFLICT (key) DO UPDATE SET value = $1`, [new Date().toISOString()]);
        const autoTranscribe = await getSetting('auto_transcribe');
        if (autoTranscribe === 'true' && transcriptionRouter?.startTranscription) {
            const openaiApiKey = await getSetting('openai_api_key');
            if (openaiApiKey) {
                for (const video of newVideos) {
                    console.log(`🎙️ Auto-transcribing: ${video.title}`);
                    transcriptionRouter.startTranscription(video.id, openaiApiKey, 'openai');
                }
            } else { console.log('⚠️ Auto-transcribe skipped: No OpenAI API key'); }
        }
    } catch (error) { console.error('❌ Auto-scan error:', error.message); }
}
