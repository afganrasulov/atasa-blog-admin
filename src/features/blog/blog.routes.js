import { Router } from 'express';
import { generateUniqueSlug, calculateReadTime, formatPost, resolveInternalLinks } from '../../shared/helpers.js';

export function blogRoutes(pool) {
    const router = Router();

    // Get all posts (admin)
    router.get('/all', async (req, res) => {
        try { res.json((await pool.query('SELECT * FROM blog_posts ORDER BY created_at DESC')).rows.map(formatPost)); }
        catch (error) { res.status(500).json({ error: 'Internal server error' }); }
    });

    // Get published posts (public)
    router.get('/', async (req, res) => {
        try { res.json((await pool.query("SELECT * FROM blog_posts WHERE status = 'published' AND is_published = true ORDER BY published_at DESC")).rows.map(formatPost)); }
        catch (error) { res.status(500).json({ error: 'Internal server error' }); }
    });

    // Get post by slug
    router.get('/:slug', async (req, res) => {
        try {
            const result = await pool.query("SELECT * FROM blog_posts WHERE slug = $1 AND is_published = true", [req.params.slug]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
            res.json(formatPost(result.rows[0]));
        } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
    });

    // Create post
    router.post('/', async (req, res) => {
        try {
            const { title, content, category, excerpt, thumbnail, status, videoId, author } = req.body;
            if (!title || !content) return res.status(400).json({ error: 'Title and content required' });
            const slug = await generateUniqueSlug(title);
            const postStatus = status || 'draft';
            const result = await pool.query(
                `INSERT INTO blog_posts (title, slug, content, category, excerpt, cover_image, read_time, status, is_published, published_at, video_id, author) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
                [title, slug, content, category || 'Genel', excerpt || content.substring(0, 150) + '...', thumbnail || '', calculateReadTime(content), postStatus, postStatus === 'published', postStatus === 'published' ? new Date() : null, videoId || null, author || 'Admin']
            );
            if (videoId) {
                await pool.query(`UPDATE youtube_videos SET blog_created = TRUE, blog_post_id = $1 WHERE id = $2`, [result.rows[0].id, videoId]);
            }
            res.status(201).json({ success: true, post: formatPost(result.rows[0]) });
        } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
    });

    // Webhook blog
    router.post('/webhook', async (req, res) => {
        try {
            const { title, content, category, excerpt, thumbnail } = req.body;
            if (!title || !content) return res.status(400).json({ error: 'Title and content required' });
            const autopilotResult = await pool.query("SELECT value FROM settings WHERE key = 'autopilot'");
            const autopilot = autopilotResult.rows[0]?.value === 'true';
            const postStatus = autopilot ? 'published' : 'draft';
            const slug = await generateUniqueSlug(title);
            const result = await pool.query(
                `INSERT INTO blog_posts (title, slug, content, category, excerpt, cover_image, read_time, status, is_published, published_at, author) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
                [title, slug, content, category || 'Genel', excerpt || content.substring(0, 150) + '...', thumbnail || '', calculateReadTime(content), postStatus, postStatus === 'published', postStatus === 'published' ? new Date() : null, 'AI']
            );
            res.status(201).json({ success: true, post: formatPost(result.rows[0]), autopilot });
        } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
    });

    // Publish
    router.put('/:id/publish', async (req, res) => {
        try {
            const result = await pool.query(`UPDATE blog_posts SET status = 'published', is_published = true, published_at = CURRENT_TIMESTAMP, scheduled_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`, [req.params.id]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
            res.json({ success: true, post: formatPost(result.rows[0]) });
        } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
    });

    // Schedule
    router.put('/:id/schedule', async (req, res) => {
        try {
            const { scheduledAt } = req.body;
            if (!scheduledAt) return res.status(400).json({ error: 'scheduledAt required' });
            const result = await pool.query(`UPDATE blog_posts SET status = 'scheduled', scheduled_at = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`, [scheduledAt, req.params.id]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
            res.json({ success: true, post: formatPost(result.rows[0]) });
        } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
    });

    // Unpublish
    router.put('/:id/unpublish', async (req, res) => {
        try {
            const result = await pool.query(`UPDATE blog_posts SET status = 'draft', is_published = false, published_at = NULL, scheduled_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`, [req.params.id]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
            res.json({ success: true, post: formatPost(result.rows[0]) });
        } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
    });

    // Update post
    router.put('/:id', async (req, res) => {
        try {
            const { title, content, category, excerpt, thumbnail, status, author, metaDescription, focusKeyword } = req.body;
            const existing = await pool.query('SELECT * FROM blog_posts WHERE id = $1', [req.params.id]);
            if (existing.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
            const post = existing.rows[0];
            const newStatus = status || post.status;
            const result = await pool.query(
                `UPDATE blog_posts SET title = $1, content = $2, category = $3, excerpt = $4, cover_image = $5, read_time = $6, status = $7, is_published = $8, author = $9, meta_description = $10, focus_keyword = $11, updated_at = CURRENT_TIMESTAMP WHERE id = $12 RETURNING *`,
                [title || post.title, content || post.content, category || post.category, excerpt || post.excerpt, thumbnail || post.cover_image, content ? calculateReadTime(content) : post.read_time, newStatus, newStatus === 'published', author || post.author, metaDescription || post.meta_description, focusKeyword || post.focus_keyword, req.params.id]
            );
            res.json({ success: true, post: formatPost(result.rows[0]) });
        } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
    });

    // Delete post
    router.delete('/:id', async (req, res) => {
        try {
            const result = await pool.query('DELETE FROM blog_posts WHERE id = $1 RETURNING title, video_id', [req.params.id]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Post not found' });
            if (result.rows[0].video_id) {
                await pool.query(`UPDATE youtube_videos SET blog_created = FALSE, blog_post_id = NULL WHERE id = $1`, [result.rows[0].video_id]);
            }
            res.json({ success: true, deleted: result.rows[0].title });
        } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
    });

    // Fix internal links in all existing posts
    router.post('/fix-internal-links', async (req, res) => {
        try {
            const postsResult = await pool.query(`SELECT id, content FROM blog_posts WHERE content LIKE '%[İLGİLİ:%'`);
            if (postsResult.rows.length === 0) return res.json({ success: true, fixed: 0, message: 'No posts with placeholders found' });

            let fixed = 0;
            for (const post of postsResult.rows) {
                const newContent = await resolveInternalLinks(post.content, post.id);
                if (newContent !== post.content) {
                    await pool.query('UPDATE blog_posts SET content = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newContent, post.id]);
                    fixed++;
                }
            }
            res.json({ success: true, fixed, total: postsResult.rows.length });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    return router;
}

// Sitemap & robots routes (mounted on app directly)
export function sitemapRoutes(app, pool) {
    function getSiteUrl(req) {
        const referer = req.get('referer') || '';
        const host = req.query.host || '';
        if (referer.includes('atasa.tr') || host.includes('atasa.tr')) return 'https://atasa.tr';
        return 'https://atasa.mobi';
    }

    app.get('/sitemap_index.xml', (req, res) => {
        const S = getSiteUrl(req);
        res.set('Content-Type', 'application/xml');
        res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <sitemap><loc>${S}/sitemap-pages.xml</loc></sitemap>\n  <sitemap><loc>${S}/sitemap-blog.xml</loc></sitemap>\n</sitemapindex>`);
    });

    app.get('/sitemap-pages.xml', (req, res) => {
        const S = getSiteUrl(req);
        res.set('Content-Type', 'application/xml');
        res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${S}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n  <url><loc>${S}/blog</loc><changefreq>daily</changefreq><priority>0.9</priority></url>\n  <url><loc>${S}/hakkimizda</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>\n  <url><loc>${S}/iletisim</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>\n  <url><loc>${S}/hizmetler</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>\n</urlset>`);
    });

    app.get('/sitemap-blog.xml', async (req, res) => {
        try {
            const S = getSiteUrl(req);
            const posts = await pool.query("SELECT slug, updated_at, published_at FROM blog_posts WHERE is_published = true ORDER BY published_at DESC");
            const urls = posts.rows.map(p => {
                const lastmod = (p.updated_at || p.published_at || new Date()).toISOString().split('T')[0];
                return `  <url><loc>${S}/blog/${p.slug}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`;
            }).join('\n');
            res.set('Content-Type', 'application/xml');
            res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`);
        } catch (error) { res.status(500).send('Error generating sitemap'); }
    });

    app.get('/robots.txt', (req, res) => {
        const S = getSiteUrl(req);
        res.set('Content-Type', 'text/plain');
        res.send(`User-agent: *\nAllow: /\nSitemap: ${S}/sitemap_index.xml`);
    });
}
