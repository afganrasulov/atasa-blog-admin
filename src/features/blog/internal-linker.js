import { pool } from '../../shared/database.js';
import { getSetting } from '../../shared/helpers.js';

const SITE_URL = 'https://atasa.tr';

/**
 * Build internal links for a single blog post using AI
 * Links are placed naturally within paragraphs using [text](url) Markdown format
 */
export async function buildInternalLinks(postId) {
    const openaiApiKey = await getSetting('openai_api_key');
    if (!openaiApiKey) throw new Error('OpenAI API key bulunamadı');

    // Get target post
    const { rows: [post] } = await pool.query(
        'SELECT id, title, slug, content FROM atasa_mobi.blog_posts WHERE id = $1',
        [postId]
    );
    if (!post) throw new Error('Yazı bulunamadı');

    // Get only PUBLISHED posts for linking (draft posts return 404)
    const { rows: otherPosts } = await pool.query(
        `SELECT title, slug FROM atasa_mobi.blog_posts 
         WHERE id != $1 AND status = 'published' AND is_published = true 
         ORDER BY created_at DESC`,
        [postId]
    );

    if (otherPosts.length === 0) return { updated: false, message: 'Bağlantı kurulacak başka yazı yok' };

    // Build the blog list for AI
    const blogList = otherPosts.map(p => `- "${p.title}" → ${SITE_URL}/blog/${p.slug}`).join('\n');

    // Strip any existing internal links to avoid duplicates
    const cleanContent = post.content
        .replace(/\[([^\]]+)\]\(https:\/\/atasa\.tr\/blog\/[^)]+\)/g, '$1')
        .replace(/<a\s+href="https:\/\/atasa\.tr\/blog\/[^"]*"[^>]*>([^<]+)<\/a>/g, '$1')
        .replace(/\n\n👉[^\n]*\n/g, '\n');

    const systemPrompt = `Sen SEO uzmanı bir editörsün. Blog yazısının içeriğine doğal iç bağlantılar ekleyeceksin.

KURALLAR:
1. En az 2, en fazla 5 iç bağlantı ekle
2. Bağlantıları paragrafların İÇİNDE doğal yerlere koy — asla yazının sonuna ekleme!
3. Mevcut cümledeki uygun kelime veya kelime grubunu anchor text olarak kullan
4. SADECE Markdown link formatı kullan: [anchor text](URL)
5. Aynı yazıya birden fazla link verme
6. Sadece gerçekten KONUYLA İLGİLİ yazılara link ver
7. Anchor text doğal olsun — "buraya tıklayın" gibi ifadeler KULLANMA
8. Anchor text 2-6 kelime olsun (tek kelime de olabilir ama tercihen birkaç kelime)
9. İçeriğin geri kalanını DEĞİŞTİRME — sadece uygun kelime/kelime gruplarını [link](url) formatına çevir
10. Markdown formatını koru (##, **, \\n vs.)
11. HTML tag'i KULLANMA — sadece Markdown [text](url) formatı

ÖRNEK:
Önce: "Türkiye'de çalışma izni almak için belirli adımları takip etmeniz gerekir."
Sonra: "Türkiye'de [çalışma izni almak](https://atasa.tr/blog/calisma-izni-rehberi) için belirli adımları takip etmeniz gerekir."

MEVCUT BLOG YAZILARI (link verilebilecekler):
${blogList}`;

    const userPrompt = `Aşağıdaki blog yazısına iç bağlantılar ekle. Sadece güncellenmiş içeriği döndür — başlık ekleme, açıklama yapma.

BAŞLIK: ${post.title}

İÇERİK:
${cleanContent}`;

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

    // Count Markdown links added
    const linkMatches = newContent.match(/\[([^\]]+)\]\(https:\/\/atasa\.tr\/blog\/[^)]+\)/g) || [];
    const linkCount = linkMatches.length;

    if (linkCount === 0) {
        return { updated: false, linkCount: 0, message: 'AI uygun bağlantı bulamadı' };
    }

    // Save updated content
    await pool.query(
        'UPDATE atasa_mobi.blog_posts SET content = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newContent, postId]
    );

    return {
        updated: true,
        linkCount,
        links: linkMatches.map(m => {
            const match = m.match(/\[([^\]]+)\]\(([^)]+)\)/);
            return { text: match?.[1] || '', href: match?.[2] || '' };
        }),
        title: post.title
    };
}

/**
 * Build internal links for all published blog posts
 */
export async function buildAllInternalLinks() {
    const { rows: posts } = await pool.query(
        `SELECT id, title FROM atasa_mobi.blog_posts 
         WHERE status = 'published' AND is_published = true 
         ORDER BY created_at DESC`
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
            // Rate limit: wait between API calls
            await new Promise(r => setTimeout(r, 1500));
        } catch (error) {
            results.processed++;
            results.errors.push({ id: post.id, title: post.title, error: error.message });
        }
    }

    return results;
}
