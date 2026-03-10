import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { extractAudio, transcribeAudio, AUDIO_DIR } from './audio-extractor.js';
import { getSetting } from '../../shared/helpers.js';

export function transcriptionRoutes(pool) {
    const router = Router();

    // In-memory job storage for transcription status
    const jobs = new Map();

    // Start transcription (internal function)
    async function startTranscription(videoId, apiKey, provider = 'openai') {
        try {
            await pool.query(`UPDATE youtube_videos SET transcript_status = 'processing', audio_status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [videoId]);

            const audioPath = path.join(AUDIO_DIR, `${videoId}.mp3`);

            // Extract audio if not exists
            if (!fs.existsSync(audioPath)) {
                console.log(`🎵 Extracting audio for ${videoId} (fallback chain)...`);
                await extractAudio(videoId);
            }

            await pool.query(`UPDATE youtube_videos SET audio_status = 'completed' WHERE id = $1`, [videoId]);

            // Transcribe
            console.log(`🎙️ Transcribing ${videoId} with ${provider}...`);
            const transcript = await transcribeAudio(audioPath, provider, apiKey, 'tr');

            await pool.query(
                `UPDATE youtube_videos SET audio_status = 'completed', transcript = $1, transcript_status = 'completed', transcript_model = $2, transcript_updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
                [transcript, provider, videoId]
            );
            console.log(`✅ Transcription completed for ${videoId}`);

            // Check auto blog creation
            await checkAutoBlogCreation(videoId);

        } catch (error) {
            console.error(`❌ Transcription failed for ${videoId}:`, error.message);
            await pool.query(
                `UPDATE youtube_videos SET transcript_status = 'failed', audio_status = CASE WHEN audio_status = 'processing' THEN 'failed' ELSE audio_status END, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
                [videoId]
            );
        }
    }

    // Auto blog creation after transcription
    async function checkAutoBlogCreation(videoId) {
        try {
            const autoBlog = await getSetting('auto_blog');
            if (autoBlog !== 'true') return;
            const openaiApiKey = await getSetting('openai_api_key');
            if (!openaiApiKey) { console.log('⚠️ Auto-blog skipped: No OpenAI API key'); return; }

            const videoResult = await pool.query('SELECT * FROM youtube_videos WHERE id = $1', [videoId]);
            if (videoResult.rows.length === 0) return;
            const video = videoResult.rows[0];
            if (!video.transcript || video.blog_created) return;

            console.log(`📝 Auto-creating blog for: ${video.title}`);
            const blogPrompt = await getSetting('blog_prompt') || getDefaultBlogPrompt();
            const seoRules = await getSetting('ai_seo_rules') || getDefaultSeoRules();
            const systemPrompt = seoRules ? `${blogPrompt}\n\n--- AI SEO KURALLARI ---\n${seoRules}` : blogPrompt;

            const { generateUniqueSlug, calculateReadTime, resolveInternalLinks } = await import('../../shared/helpers.js');

            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiApiKey}` },
                body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: `Video Başlığı: ${video.title}\n\nTranskript:\n${video.transcript}` }], temperature: 0.7, max_tokens: 6000 })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error.message);
            const content = data.choices[0].message.content;
            const titleMatch = content.match(/BAŞLIK:\s*(.+)/);
            const blogTitle = titleMatch ? titleMatch[1].trim() : video.title;
            const rawContent = content.replace(/BAŞLIK:\s*.+\n---\n?/, '').trim();
            const blogContent = await resolveInternalLinks(rawContent);
            const autoPublish = await getSetting('auto_publish');
            const postStatus = autoPublish === 'true' ? 'published' : 'draft';
            const slug = await generateUniqueSlug(blogTitle);
            const postResult = await pool.query(
                `INSERT INTO blog_posts (title, slug, content, category, excerpt, cover_image, read_time, status, is_published, published_at, video_id, author) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
                [blogTitle, slug, blogContent, video.video_type === 'short' ? 'Shorts' : 'YouTube', blogContent.substring(0, 150) + '...', video.thumbnail, calculateReadTime(blogContent), postStatus, postStatus === 'published', postStatus === 'published' ? new Date() : null, videoId, 'AI']
            );
            await pool.query(`UPDATE youtube_videos SET blog_created = TRUE, blog_post_id = $1 WHERE id = $2`, [postResult.rows[0].id, videoId]);
            console.log(`✅ Auto-blog created: ${blogTitle} (${postStatus})`);
        } catch (error) { console.error(`❌ Auto-blog creation failed for ${videoId}:`, error.message); }
    }

    // Transcribe single video
    router.post('/videos/:id/transcribe', async (req, res) => {
        try {
            const videoId = req.params.id;
            const { apiKey, provider } = req.body;
            if (!apiKey) return res.status(400).json({ error: 'apiKey required' });
            const videoResult = await pool.query('SELECT * FROM youtube_videos WHERE id = $1', [videoId]);
            if (videoResult.rows.length === 0) return res.status(404).json({ error: 'Video not found' });
            const transcriptionProvider = provider || await getSetting('transcription_provider') || 'openai';
            res.json({ success: true, status: 'processing', provider: transcriptionProvider });
            startTranscription(videoId, apiKey, transcriptionProvider);
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    // Bulk transcribe
    router.post('/videos/bulk-transcribe', async (req, res) => {
        try {
            const { videoIds, apiKey, provider } = req.body;
            if (!videoIds || !Array.isArray(videoIds)) return res.status(400).json({ error: 'videoIds array required' });
            if (!apiKey) return res.status(400).json({ error: 'apiKey required' });
            const transcriptionProvider = provider || await getSetting('transcription_provider') || 'openai';
            for (const videoId of videoIds) {
                startTranscription(videoId, apiKey, transcriptionProvider);
            }
            res.json({ success: true, count: videoIds.length, status: 'processing' });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    // Reset failed
    router.post('/videos/reset-failed', async (req, res) => {
        try {
            const { videoIds } = req.body;
            if (!videoIds || !Array.isArray(videoIds)) return res.status(400).json({ error: 'videoIds array required' });
            const result = await pool.query(
                `UPDATE youtube_videos SET transcript_status = 'pending', audio_status = 'pending', audio_url = NULL, transcript_job_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($1::text[]) AND transcript_status = 'failed'`,
                [videoIds]
            );
            res.json({ success: true, reset: result.rowCount });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    // Extract audio only
    router.post('/videos/:id/extract-audio', async (req, res) => {
        try {
            const videoId = req.params.id;
            await pool.query(`UPDATE youtube_videos SET audio_status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [videoId]);
            res.json({ success: true, status: 'processing' });

            (async () => {
                try {
                    const result = await extractAudio(videoId);
                    await pool.query(`UPDATE youtube_videos SET audio_url = $1, audio_status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [result.outputPath, videoId]);
                    console.log(`✅ Audio extracted for ${videoId}`);
                } catch (error) {
                    await pool.query(`UPDATE youtube_videos SET audio_status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [videoId]);
                    console.error(`❌ Audio extraction failed for ${videoId}:`, error.message);
                }
            })();
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    // Get audio file
    router.get('/audio/:videoId', (req, res) => {
        const audioPath = path.join(AUDIO_DIR, `${req.params.videoId}.mp3`);
        if (!fs.existsSync(audioPath)) return res.status(404).json({ error: 'Audio not found' });
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', `attachment; filename="${req.params.videoId}.mp3"`);
        fs.createReadStream(audioPath).pipe(res);
    });

    // Expose startTranscription for scheduler
    router.startTranscription = startTranscription;

    return router;
}

function getDefaultBlogPrompt() {
    return `Sen Türkiye'deki göçmenlik, oturma izni, çalışma izni, vatandaşlık ve vize konularında uzman bir SEO blog yazarısın.

Verilen video transkriptini kullanarak hem Google hem de AI arama platformlarında (ChatGPT, Perplexity, Google AI Overview) üst sıralarda çıkacak, kapsamlı bir blog yazısı oluştur.

## FORMAT KURALLARI
- İlk satır: BAŞLIK: [SEO optimize başlık] ardından "---"
- İçerik en az 1000 kelime olmalı
- Markdown formatı kullan: ## alt başlıklar, **kalın**, - listeler
- Her 200-300 kelimede bir ## alt başlık kullan
- Paragraflar 3-4 cümle olsun, kolay okunabilir

## İÇERİK YAPISI
1. Giriş paragrafı — konuyu özetle, okuyucuyu çek (2-3 cümle)
2. Ana içerik — ## başlıklarla bölümlenmiş, detaylı bilgi
3. Pratik adımlar — numaralı liste veya madde işaretleri ile
4. ## Sıkça Sorulan Sorular — en az 3 soru-cevap (### S: ve Cevap formatında)
5. Sonuç — özetle ve CTA ekle

## SEO KURALLARI
- Başlık 50-60 karakter, ana anahtar kelimeyi içersin
- İlk 160 karakterde ana konu geçsin (meta description)
- Doğal anahtar kelime yoğunluğu (%1-2)
- İç bağlantı önerileri: [İLGİLİ: konu başlığı] formatında yaz. Sistem bunları otomatik gerçek linklere dönüştürecek.
- "Türkiye", "güncel" gibi taze kelimeler kullan

## AI SEO (AEO) KURALLARI
- Doğrudan, net cevaplar ver (AI snippet'a uygun)
- Soru-cevap formatı kullan (Perplexity/ChatGPT alıntılayabilsin)
- Karmaşık konuları adım adım açıkla
- Güvenilir kaynak referansları ekle (GİB, ÇSGB, Resmi Gazete)
- "Ne", "Nasıl", "Ne zaman", "Kaç" gibi soru kalıplarını doğal kullan

## DİL VE TON
- Samimi ama profesyonel
- Türkçe karakter kullan (ğ, ü, ş, ı, ö, ç)
- Teknik terimleri parantez içinde açıkla
- Doğal ve akıcı — robot gibi yazma`;
}

function getDefaultSeoRules() {
    return `## Google SEO
- Title tag: Ana anahtar kelime + yıl + konum (Türkiye)
- H2/H3 hiyerarşisi: Her bölüm ayrı H2, alt detaylar H3
- Featured snippet hedefle: Listeleri ve tanımları net yaz
- E-E-A-T sinyalleri: Deneyim, uzmanlık, otorite, güvenilirlik göster
- Internal linking: İlgili konulara referans ver

## AI Arama Optimizasyonu (AEO)
- Concise answers: İlk 2 cümlede sorunun cevabını ver
- Structured data: FAQ, HowTo, Article yapısına uygun yaz
- Citation-worthy: AI'ın alıntılamak isteyeceği net, özlü paragraflar
- Fact-based: Rakam, tarih, resmi kaynak referansı kullan
- Conversational queries: "X nasıl yapılır?", "X için ne gerekli?" sorularına doğrudan cevap ver`;
}
