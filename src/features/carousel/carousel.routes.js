import { Router } from 'express';

export function carouselRoutes(pool) {
    const router = Router();

    // Demo news
    router.get('/demo-news', (req, res) => res.json(generateDemoNews()));

    // List carousels
    router.get('/', async (req, res) => {
        try {
            const { tenant } = req.query;
            let query = 'SELECT c.*, t.name as tenant_name, t.brand_name FROM carousel_posts c LEFT JOIN ig_tenants t ON c.tenant_id = t.id';
            let params = [];
            if (tenant) { query += ' WHERE t.slug = $1'; params.push(tenant); }
            query += ' ORDER BY c.created_at DESC';
            res.json((await pool.query(query, params)).rows);
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    // Get single
    router.get('/:id', async (req, res) => {
        try {
            const result = await pool.query('SELECT c.*, t.name as tenant_name, t.brand_name, t.default_hashtags FROM carousel_posts c LEFT JOIN ig_tenants t ON c.tenant_id = t.id WHERE c.id = $1', [req.params.id]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Carousel not found' });
            res.json(result.rows[0]);
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    // Create
    router.post('/', async (req, res) => {
        try {
            const { title, week_start, week_end, slides, raw_news, cover_image_prompt, tenant_id, caption } = req.body;
            const result = await pool.query(
                `INSERT INTO carousel_posts (title, week_start, week_end, slides, raw_news, cover_image_prompt, tenant_id, caption) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
                [title, week_start, week_end, JSON.stringify(slides || []), JSON.stringify(raw_news || []), cover_image_prompt, tenant_id || null, caption || null]
            );
            res.status(201).json({ success: true, carousel: result.rows[0] });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    // Update
    router.put('/:id', async (req, res) => {
        try {
            const { title, slides, cover_image_url, cover_image_prompt, status, caption, scheduled_at } = req.body;
            const result = await pool.query(
                `UPDATE carousel_posts SET title = COALESCE($1, title), slides = COALESCE($2, slides), cover_image_url = COALESCE($3, cover_image_url), cover_image_prompt = COALESCE($4, cover_image_prompt), status = COALESCE($5, status), caption = COALESCE($6, caption), scheduled_at = COALESCE($7, scheduled_at), updated_at = CURRENT_TIMESTAMP, published_at = CASE WHEN $5 = 'published' THEN CURRENT_TIMESTAMP ELSE published_at END WHERE id = $8 RETURNING *`,
                [title, slides ? JSON.stringify(slides) : null, cover_image_url, cover_image_prompt, status, caption, scheduled_at, req.params.id]
            );
            if (result.rows.length === 0) return res.status(404).json({ error: 'Carousel not found' });
            res.json({ success: true, carousel: result.rows[0] });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    // Delete
    router.delete('/:id', async (req, res) => {
        try { await pool.query('DELETE FROM carousel_posts WHERE id = $1', [req.params.id]); res.json({ success: true }); }
        catch (error) { res.status(500).json({ error: error.message }); }
    });

    // Generate carousel from news
    router.post('/generate', async (req, res) => {
        try {
            const { news_data, tenant_id } = req.body;
            if (!news_data) return res.status(400).json({ error: 'news_data required' });

            let brandName = 'ATASA', hashtags = '';
            if (tenant_id) {
                const tenantResult = await pool.query('SELECT brand_name, default_hashtags FROM ig_tenants WHERE id = $1', [tenant_id]);
                if (tenantResult.rows.length > 0) {
                    brandName = tenantResult.rows[0].brand_name || brandName;
                    hashtags = tenantResult.rows[0].default_hashtags || '';
                }
            }

            const slides = createSlidesWithBrand(news_data, brandName);
            const caption = generateCaption(news_data, hashtags);

            const result = await pool.query(
                `INSERT INTO carousel_posts (title, week_start, week_end, slides, raw_news, cover_image_prompt, tenant_id, caption) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
                [`Göçmenlik Haberleri - ${news_data.weekRange}`, news_data.weekStart, news_data.weekEnd, JSON.stringify(slides), JSON.stringify(news_data), generateCoverPrompt(news_data), tenant_id || null, caption]
            );

            res.status(201).json({ success: true, carousel: result.rows[0], slides_count: slides.length });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    return router;
}

function generateDemoNews() {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const formatDate = (d) => `${d.getDate()} ${['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'][d.getMonth()]}`;
    return {
        weekRange: `${formatDate(weekStart)} - ${formatDate(weekEnd)} ${today.getFullYear()}`,
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
        categories: [
            { name: "Oturma İzni", emoji: "🏠", news: [{ title: "Kısa dönem oturma izni başvurularında yeni düzenleme yapıldı.", source: "GİB", url: "https://goc.gov.tr" }, { title: "İstanbul'da oturma izni randevu sistemi güncellendi.", source: "İl Göç", url: "https://istanbul.goc.gov.tr" }, { title: "Aile ikamet izni için gerekli belgeler listesi yenilendi.", source: "GİB", url: "https://goc.gov.tr" }] },
            { name: "Çalışma İzni", emoji: "💼", news: [{ title: "Yabancı çalışanlar için yeni istihdam teşviki açıklandı.", source: "ÇSGB", url: "https://csgb.gov.tr" }, { title: "Bağımsız çalışma izni başvuru süreci kolaylaştırıldı.", source: "ÇSGB", url: "https://csgb.gov.tr" }, { title: "Turkuaz Kart sahipleri için yeni haklar tanımlandı.", source: "Resmi Gazete", url: "https://resmigazete.gov.tr" }] },
            { name: "Vatandaşlık", emoji: "🇹🇷", news: [{ title: "Yatırım yoluyla vatandaşlık için dolar kuru güncellendi.", source: "Nüfus", url: "https://nvi.gov.tr" }, { title: "Olağanüstü vatandaşlık başvuruları hızlandırılıyor.", source: "İçişleri", url: "https://icisleri.gov.tr" }] },
            { name: "Vize", emoji: "✈️", news: [{ title: "Schengen vize randevuları için yeni dönem başlıyor.", source: "Konsolosluk", url: "https://vfs.com" }, { title: "Türkiye-Rusya arasında vizesiz seyahat süresi uzatıldı.", source: "Dışişleri", url: "https://mfa.gov.tr" }, { title: "E-Vize sistemine yeni ülkeler eklendi.", source: "E-Vize", url: "https://evisa.gov.tr" }] },
            { name: "Genel", emoji: "📢", news: [{ title: "Göç İdaresi online hizmetler portalı yenilendi.", source: "GİB", url: "https://goc.gov.tr" }, { title: "Yabancılar için TÜRKSAT uydu TV paketi tanıtıldı.", source: "TÜRKSAT", url: "https://turksat.com.tr" }] }
        ]
    };
}

function createSlidesWithBrand(rawNews, brandName) {
    const slides = [];
    slides.push({ type: 'cover', title: 'Türkiye Göçmenlik Haberleri', subtitle: rawNews.weekRange, brand: brandName, image_placeholder: true });
    slides.push({ type: 'intro', greeting: 'Merhaba,', content: `Bu hafta Göçmenlik Haberleri serisinde, Türkiye'deki göçmenlik mevzuatı ve uygulamalarındaki son gelişmeleri sizin için derledik.\n\nOturma izni düzenlemelerinden çalışma izni kolaylıklarına, vatandaşlık güncellemelerinden vize haberlerine kadar bu sayıda haberdar olmanız gereken birçok yeni gelişme sizi bekliyor.\n\nKeyifli okumalar ☕`, brand: brandName });
    rawNews.categories.forEach(cat => {
        slides.push({ type: 'category', emoji: cat.emoji, category: cat.name, items: cat.news.map(n => ({ text: n.title, source: n.source, url: n.url })), brand: brandName });
    });
    return slides;
}

function generateCaption(news, hashtags) {
    let caption = `📰 Türkiye Göçmenlik Haberleri - ${news.weekRange}\n\n`;
    caption += `Bu hafta ${news.categories.length} farklı kategoride güncel haberler sizlerle!\n\n`;
    news.categories.forEach(cat => { caption += `${cat.emoji} ${cat.name}\n`; });
    caption += `\n📌 Kaydırarak tüm haberleri görüntüleyin!\n\n`;
    caption += hashtags || '#göçmenlik #türkiye #oturmaiizni #çalışmaizni #vize #vatandaşlık';
    return caption;
}

function generateCoverPrompt() {
    return `Minimalist black and white illustration for Instagram carousel cover. Theme: Immigration and travel in Turkey. Style: Clean line art, similar to modern editorial illustrations. Elements: Two people - one holding documents/passport, another with a suitcase or looking at a phone. No text in the image itself. Professional, friendly, and approachable mood.`;
}
