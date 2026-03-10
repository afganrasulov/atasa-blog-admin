// features/transcription/blog-generator.js - AI Blog Generation
import { API, state } from '../../shared/config.js';
import { toast, showLoading, hideLoading, closeModal, switchPage } from '../../shared/utils.js';
import { loadVideos } from '../youtube/videos.js';
import { loadPosts } from '../blog-posts/posts.js';
import { getBlogSystemPrompt } from '../settings/settings.js';

let currentBlogData = { title: '', meta: '', content: '' };

function parseBlogContent(content) {
    let title = '';
    let meta = '';
    let htmlContent = '';
    content = content.replace(/\*\*/g, '');
    const titleMatch = content.match(/BAŞLIK:\s*(.+?)(?:\n|$)/i);
    if (titleMatch) { title = titleMatch[1].trim(); }
    const metaMatch = content.match(/META:\s*(.+?)(?:\n---|\\n\\n|$)/is);
    if (metaMatch) { meta = metaMatch[1].trim(); }
    const parts = content.split('---');
    if (parts.length >= 2) { htmlContent = parts[parts.length - 1].trim(); }
    else { htmlContent = content.replace(/BAŞLIK:\s*.+?\n/gi, '').replace(/META:\s*.+?\n/gi, '').trim(); }
    htmlContent = htmlContent.replace(/^BAŞLIK:\s*.+?\n/gim, '').replace(/^META:\s*.+?\n/gim, '').replace(/^META AÇIKLAMA:\s*.+?\n/gim, '').trim();
    return { title, meta, htmlContent };
}

export async function generateBlog() {
    const transcript = document.getElementById('videoTranscript').value.trim();
    if (!transcript || transcript.length < 50) { toast('Önce transkript girin'); return; }
    if (!state.settings.openaiApiKey) { toast('OpenAI API Key gerekli!'); switchPage('settings'); closeModal('video'); return; }
    if (state.currentVideo?.blog_created) {
        if (!confirm('Bu video için zaten blog yazısı oluşturulmuş. Yeniden oluşturmak istediğinize emin misiniz?')) return;
    }
    showLoading('Blog yazısı oluşturuluyor...');
    try {
        const systemPrompt = getBlogSystemPrompt();
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.settings.openaiApiKey}` },
            body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: `Video Başlığı: ${state.currentVideo?.title}\n\nTranskript:\n${transcript}` }], temperature: 0.7, max_tokens: 3500 })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        const content = data.choices[0].message.content;
        const parsed = parseBlogContent(content);
        currentBlogData = { title: parsed.title || state.currentVideo?.title || 'Blog', meta: parsed.meta, content: parsed.htmlContent };
        document.getElementById('blogTitle').value = currentBlogData.title;
        document.getElementById('blogContent').value = currentBlogData.content;
        document.getElementById('blogPreview').classList.remove('hidden');
        document.getElementById('saveDraftBtn').classList.remove('hidden');
        document.getElementById('publishBtn').classList.remove('hidden');
        hideLoading();
        toast('Blog yazısı oluşturuldu ✓');
    } catch (e) { hideLoading(); toast('Hata: ' + e.message); }
}

export async function saveBlog(status) {
    const title = document.getElementById('blogTitle').value.trim();
    const content = document.getElementById('blogContent').value.trim();
    if (!title || !content) { toast('Başlık ve içerik gerekli'); return; }
    showLoading('Kaydediliyor...');
    let excerpt = currentBlogData.meta;
    if (!excerpt) {
        const textContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        excerpt = textContent.substring(0, 155);
        if (textContent.length > 155) excerpt += '...';
    }
    const res = await fetch(`${API}/api/posts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, excerpt, category: state.currentVideo?.duration <= 60 ? 'Shorts' : 'YouTube', thumbnail: state.currentVideo?.thumbnail, status, videoId: state.currentVideo?.id })
    });
    if (res.ok) { if (state.currentVideo) { state.currentVideo.blog_created = true; } }
    currentBlogData = { title: '', meta: '', content: '' };
    hideLoading(); closeModal('video'); loadVideos(); switchPage('posts'); loadPosts();
    toast(status === 'published' ? 'Yayınlandı! 🚀' : 'Taslak kaydedildi 📝');
}
