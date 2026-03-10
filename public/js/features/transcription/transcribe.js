// features/transcription/transcribe.js - Transcription functions
import { API, state } from '../../shared/config.js';
import { toast, switchPage, closeModal } from '../../shared/utils.js';
import { loadVideos, updateModalBadges } from '../youtube/videos.js';

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

export async function transcribeAll(type) {
    const config = getTranscriptionConfig();
    if (!config) return;
    const videos = state.cachedVideos[type].filter(v => !v.transcript && v.transcript_status !== 'processing');
    if (!videos.length) { toast('Deşifre edilecek video yok'); return; }
    toast(`${videos.length} video deşifre edilmeye başlıyor (${config.provider.toUpperCase()})...`);
    for (const video of videos) {
        try {
            await fetch(`${API}/api/youtube/videos/${video.id}/transcribe`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: config.apiKey, provider: config.provider })
            });
        } catch (e) { console.error('Transcribe error:', e); }
    }
    loadVideos();
    toast('Arka planda işlem başladı ✓');
}

export async function startBackgroundTranscription() {
    if (!state.currentVideo) return;
    const config = getTranscriptionConfig();
    if (!config) { closeModal('video'); return; }
    const btn = document.getElementById('transcribeBtn');
    btn.disabled = true;
    btn.innerHTML = `<span class="inline-block animate-spin">⏳</span> ${config.provider === 'openai' ? 'Whisper' : 'AssemblyAI'}...`;
    try {
        const res = await fetch(`${API}/api/youtube/videos/${state.currentVideo.id}/transcribe`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: config.apiKey, provider: config.provider })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        toast(`Deşifre başladı (${config.provider.toUpperCase()}) ✓`);
        btn.innerHTML = '<span class="inline-block animate-spin">⏳</span> İşleniyor...';
        state.currentVideo.transcript_status = 'processing';
        updateModalBadges();
        loadVideos();
    } catch (e) {
        console.error('Transcription error:', e);
        toast('Hata: ' + e.message);
        btn.disabled = false;
        btn.textContent = '🎙️ Deşifre Et';
    }
}
