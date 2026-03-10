import { pool } from './database.js';

export function generateSlug(title) {
    return title.toLowerCase().replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').trim();
}

export async function generateUniqueSlug(title) {
    const base = generateSlug(title);
    const existing = await pool.query('SELECT slug FROM blog_posts WHERE slug = $1 OR slug LIKE $2', [base, base + '-%']);
    if (existing.rows.length === 0) return base;
    const slugs = existing.rows.map(r => r.slug);
    if (!slugs.includes(base)) return base;
    let i = 2;
    while (slugs.includes(`${base}-${i}`)) i++;
    return `${base}-${i}`;
}

export function formatDateTR() {
    return new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function calculateReadTime(content) {
    return Math.ceil(content.split(' ').length / 200) + ' dk okuma';
}

export function parseDuration(d) {
    const m = d.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    return (parseInt(m?.[1]) || 0) * 3600 + (parseInt(m?.[2]) || 0) * 60 + (parseInt(m?.[3]) || 0);
}

export async function getSetting(key) {
    const result = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
    return result.rows[0]?.value || null;
}

export function formatPost(row) {
    return {
        id: row.id.toString(), title: row.title, slug: row.slug, content: row.content,
        category: row.category, excerpt: row.excerpt, thumbnail: row.cover_image || row.thumbnail,
        coverImage: row.cover_image, tags: row.tags, author: row.author, readTime: row.read_time,
        status: row.status, isPublished: row.is_published, scheduledAt: row.scheduled_at,
        publishedAt: row.published_at, videoId: row.video_id, metaDescription: row.meta_description,
        focusKeyword: row.focus_keyword, schemaType: row.schema_type,
        createdAt: row.created_at, updatedAt: row.updated_at
    };
}

// Resolve [İLGİLİ: konu] placeholders to real internal links
export async function resolveInternalLinks(content, currentPostId = null) {
    const SITE_URL = 'https://atasa.tr';
    const placeholderRegex = /\[İLGİLİ:\s*([^\]]+)\]/gi;
    const matches = [...content.matchAll(placeholderRegex)];

    if (matches.length === 0) return content;

    // Get all blog posts for matching
    let query = 'SELECT id, title, slug FROM blog_posts WHERE status IN ($1, $2)';
    const params = ['published', 'draft'];
    if (currentPostId) {
        query += ' AND id != $3';
        params.push(currentPostId);
    }
    const { rows: allPosts } = await pool.query(query, params);

    if (allPosts.length === 0) {
        // No posts to link to — remove placeholders
        return content.replace(placeholderRegex, '');
    }

    let result = content;

    for (const match of matches) {
        const fullMatch = match[0];
        const topic = match[1].trim().toLowerCase();
        const topicWords = topic.split(/\s+/).filter(w => w.length > 2);

        // Score each post by keyword overlap
        let bestMatch = null;
        let bestScore = 0;

        for (const post of allPosts) {
            const titleLower = post.title.toLowerCase();
            let score = 0;

            // Exact substring match (strongest signal)
            if (titleLower.includes(topic)) {
                score += 10;
            }

            // Word-level matching
            for (const word of topicWords) {
                if (titleLower.includes(word)) {
                    score += 2;
                }
            }

            // Bonus for shorter titles (more specific match)
            if (score > 0 && post.title.length < 80) {
                score += 1;
            }

            if (score > bestScore) {
                bestScore = score;
                bestMatch = post;
            }
        }

        if (bestMatch && bestScore >= 2) {
            // Replace with simple HTML link (no style — avoids sanitizer stripping)
            const link = `<a href="${SITE_URL}/blog/${bestMatch.slug}">${bestMatch.title}</a>`;
            result = result.replace(fullMatch, `\n\n👉 **İlgili yazı:** ${link}\n`);
        } else {
            // No good match found — just remove the placeholder
            result = result.replace(fullMatch, '');
        }
    }

    // Clean up any leftover empty lines
    result = result.replace(/\n{3,}/g, '\n\n');
    return result;
}
