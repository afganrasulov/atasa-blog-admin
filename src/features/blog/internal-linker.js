import { pool } from '../../shared/database.js';
import { getSetting } from '../../shared/helpers.js';

const SITE_URL = 'https://atasa.tr';

/**
 * Build internal links for a single blog post using AI
 */
export async function buildInternalLinks(postId) {
    const openaiApiKey = await getSetting('openai_api_key');
    if (!openaiApiKey) throw new Error('OpenAI API key bulunamadı');

    // Get target post
    const { rows: [post] } = await pool.query('SELECT id, title, slug, content FROM blog_posts WHERE id = $1', [postId]);
    if (!post) throw new Error('Yazı bulunamadı');

    // Get all other posts for linking
    const { rows: otherPosts } = await pool.query(
        `SELECT title, slug FROM blog_posts WHERE id != $1 AND status = 'published' AND is_published = true ORDER BY created_at DESC`,
        [postId]
    );

    if (otherPosts.length === 0) return { updated: false, message: 'Bağlantı kurulacak başka yazı yok' };

    // Build the blog list for AI
    const blogList = otherPosts.map(p => `- ${p.title} → ${SITE_URL}/blog/${p.slug}`).join('\n');

    // First, strip any existing internal links to avoid duplicates
    const cleanContent = post.content
        .replace(/<a\s+href="https:\/\/atasa\.tr\/blog\/[^"]*"[^>]*>([^<]+)<\/a>/g, '$1')
        .replace(/\n\n👉 \*\*İlgili yazı:\*\*.+\n/g, '');

    const systemPrompt = `Sen SEO uzmanı bir editörsün. Blog yazısının içeriğine doğal iç bağlantılar ekleyeceksin.

KURALLAR:
1. Yazının içinde en az 2, en fazla 5 iç bağlantı ekle
2. Bağlantıyı metnin İÇİNDE doğal bir yere yerleştir — yazının sonuna ekleme!
3. Mevcut cümledeki uygun kelime veya kelime grubunu anchor text olarak kullan
4. <a href="URL">anchor text</a> formatında ekle
5. Aynı yazıya birden fazla link verme
6. Sadece gerçekten KONUYLA İLGİLİ yazılara link ver
7. Anchor text doğal ve SEO dostu olsun — "buraya tıklayın" gibi ifadeler KULLANMA
8. İçeriğin geri kalanını DEĞİŞTİRME — sadece link ekle
9. Markdown formatını koru (##, **, \\n vs.)

MEVCUT BLOG YAZILARI (link verilebilecekler):
${blogList}`;

    const userPrompt = `Aşağıdaki blog yazısına iç bağlantılar ekle:

BAŞLIK: ${post.title}

İÇERİK:
${cleanContent}

Sadece güncellenmiş içeriği döndür. Başlık ekleme, açıklama yapma — sadece içerik.`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiApiKey}` },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.3,
            max_tokens: 8000
        })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    const newContent = data.choices[0].message.content.trim();

    // Count how many links were added
    const linkMatches = newContent.match(/<a\s+href="https:\/\/atasa\.tr\/blog\/[^"]*"[^>]*>[^<]+<\/a>/g) || [];
    const linkCount = linkMatches.length;

    if (linkCount === 0) {
        return { updated: false, linkCount: 0, message: 'AI uygun bağlantı bulamadı' };
    }

    // Save updated content
    await pool.query(
        'UPDATE blog_posts SET content = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newContent, postId]
    );

    return {
        updated: true,
        linkCount,
        links: linkMatches.map(m => {
            const href = m.match(/href="([^"]+)"/)?.[1] || '';
            const text = m.match(/>([^<]+)</)?.[1] || '';
            return { href, text };
        }),
        title: post.title
    };
}

/**
 * Build internal links for all blog posts
 */
export async function buildAllInternalLinks(onProgress) {
    const { rows: posts } = await pool.query(
        `SELECT id, title FROM blog_posts WHERE status IN ('published', 'draft') ORDER BY created_at DESC`
    );

    const results = { total: posts.length, processed: 0, updated: 0, totalLinks: 0, errors: [] };

    for (const post of posts) {
        try {
            const result = await buildInternalLinks(post.id);
            results.processed++;
            if (result.updated) {
                results.updated++;
                results.totalLinks += result.linkCount;
            }
            if (onProgress) onProgress(results);
            // Rate limit: wait between API calls
            await new Promise(r => setTimeout(r, 1000));
        } catch (error) {
            results.processed++;
            results.errors.push({ id: post.id, title: post.title, error: error.message });
        }
    }

    return results;
}
