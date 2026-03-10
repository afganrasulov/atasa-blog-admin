// features/youtube/selection.js - Video selection & bulk operations
import { API, state } from '../../shared/config.js';
import { toast, showLoading, hideLoading, switchPage } from '../../shared/utils.js';
import { loadVideos, renderVideos } from './videos.js';
import { getBlogSystemPrompt } from '../settings/settings.js';

// Selected videos for bulk operations
export const selectedVideos = {
    video: new Set(),
    short: new Set()
};

// Filter state
export const videoFilter = {
    video: 'all',
    short: 'all'
};

export function filterVideos(videos, type) {
    const filter = videoFilter[type];
    if (filter === 'all') return videos;
    if (filter === 'no-blog') return videos.filter(v => !v.blog_created);
    if (filter === 'with-transcript') return videos.filter(v => v.transcript && v.transcript_status === 'completed' && !v.blog_created);
    return videos;
}

export function toggleVideoSelection(type, videoId) {
    if (selectedVideos[type].has(videoId)) {
        selectedVideos[type].delete(videoId);
    } else {
        selectedVideos[type].add(videoId);
    }
    renderVideos(type);
}

export function toggleSelectAll(type) {
    const videos = filterVideos(state.cachedVideos[type], type);
    if (selectedVideos[type].size === videos.length) {
        selectedVideos[type].clear();
    } else {
        videos.forEach(v => selectedVideos[type].add(v.id));
    }
    renderVideos(type);
}

export function clearSelection(type) {
    selectedVideos[type].clear();
    renderVideos(type);
}

export function setVideoFilter(type, filter) {
    videoFilter[type] = filter;
    selectedVideos[type].clear();
    renderVideos(type);
}

function getTranscriptionConfig() {
    const provider = state.settings.transcriptionProvider || 'openai';
    let apiKey;
    if (provider === 'openai') {
        apiKey = state.settings.openaiApiKey;
        if (!apiKey) { toast('OpenAI API Key gerekli!'); switchPage('settings'); return null; }
    } else {
        apiKey = state.settings.assemblyaiApiKey;
        if (!apiKey) { toast('AssemblyAI API Key gerekli!'); switchPage('settings'); return null; }
    }
    return { provider, apiKey };
}

export async function bulkTranscribe(type) {
    const ids = Array.from(selectedVideos[type]);
    if (ids.length === 0) { toast('Video seçin'); return; }
    const config = getTranscriptionConfig();
    if (!config) return;
    toast(`${ids.length} video deşifre edilmeye başlıyor...`);
    try {
        await fetch(`${API}/api/youtube/videos/bulk-transcribe`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoIds: ids, apiKey: config.apiKey, provider: config.provider })
        });
        selectedVideos[type].clear(); loadVideos();
        toast(`${ids.length} video için deşifre başlatıldı ✓`);
    } catch (e) { toast('Hata: ' + e.message); }
}

export async function bulkGenerateBlog(type) {
    const ids = Array.from(selectedVideos[type]);
    if (ids.length === 0) { toast('Video seçin'); return; }

    const videosWithTranscript = ids.filter(id => {
        const video = state.cachedVideos[type].find(v => v.id === id);
        return video && video.transcript && video.transcript_status === 'completed';
    });

    if (videosWithTranscript.length === 0) { toast('Seçili videolarda deşifre bulunamadı. Önce deşifre edin.'); return; }

    const videosWithBlog = videosWithTranscript.filter(id => {
        const video = state.cachedVideos[type].find(v => v.id === id);
        return video && video.blog_created;
    });

    if (videosWithBlog.length > 0) {
        const confirmMsg = videosWithBlog.length === videosWithTranscript.length
            ? `Seçili ${videosWithBlog.length} videonun tamamı için zaten blog oluşturulmuş. Yine de devam etmek istiyor musunuz?`
            : `Seçili ${videosWithTranscript.length} videodan ${videosWithBlog.length} tanesi için zaten blog oluşturulmuş. Devam etmek istiyor musunuz?`;
        if (!confirm(confirmMsg)) return;
    }

    if (!state.settings.openaiApiKey) { toast('OpenAI API Key gerekli!'); switchPage('settings'); return; }

    showLoading(`${videosWithTranscript.length} video için blog oluşturuluyor...`);
    const systemPrompt = getBlogSystemPrompt();
    let successCount = 0; let failCount = 0;

    for (const videoId of videosWithTranscript) {
        const video = state.cachedVideos[type].find(v => v.id === videoId);
        if (!video) continue;
        try {
            document.getElementById('loadingText').textContent = `Blog oluşturuluyor: ${video.title.substring(0, 30)}...`;
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.settings.openaiApiKey}` },
                body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: `Video Başlığı: ${video.title}\n\nTranskript:\n${video.transcript}` }], temperature: 0.7, max_tokens: 3500 })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error.message);
            const content = data.choices[0].message.content;
            const titleMatch = content.match(/BAŞLIK:\s*(.+)/);
            const blogTitle = titleMatch ? titleMatch[1].trim() : video.title;
            const blogContent = content.replace(/BAŞLIK:\s*.+\n---\n?/, '').trim();
            const postRes = await fetch(`${API}/api/posts`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: blogTitle, content: blogContent, category: video.duration <= 60 ? 'Shorts' : 'YouTube', thumbnail: video.thumbnail, status: 'draft', videoId: video.id })
            });
            if (postRes.ok) { successCount++; } else { failCount++; }
            await new Promise(r => setTimeout(r, 1000));
        } catch (e) { console.error(`Blog creation failed for ${videoId}:`, e); failCount++; }
    }

    hideLoading(); selectedVideos[type].clear(); loadVideos();
    toast(failCount === 0 ? `${successCount} blog yazısı oluşturuldu ✓` : `${successCount} başarılı, ${failCount} başarısız`);
}
