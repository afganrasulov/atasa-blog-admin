// transcription.js - Transcription & Blog Generation
import { API, state } from './config.js';
import { toast, showLoading, hideLoading, closeModal, switchPage } from './utils.js';
import { loadVideos, updateModalBadges } from './videos.js';
import { loadPosts } from './posts.js';

// Get current provider and API key
function getTranscriptionConfig() {
  const provider = state.settings.transcriptionProvider || 'openai';
  let apiKey;
  
  if (provider === 'openai') {
    apiKey = state.settings.openaiApiKey;
    if (!apiKey) {
      toast('OpenAI API Key gerekli!');
      switchPage('settings');
      return null;
    }
  } else {
    apiKey = state.settings.assemblyaiApiKey;
    if (!apiKey) {
      toast('AssemblyAI API Key gerekli!');
      switchPage('settings');
      return null;
    }
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          apiKey: config.apiKey,
          provider: config.provider
        })
      });
    } catch (e) { console.error('Transcribe error:', e); }
  }
  loadVideos();
  toast('Arka planda işlem başladı ✓');
}

export async function startBackgroundTranscription() {
  if (!state.currentVideo) return;
  
  const config = getTranscriptionConfig();
  if (!config) {
    closeModal('video');
    return;
  }
  
  const btn = document.getElementById('transcribeBtn');
  btn.disabled = true;
  btn.innerHTML = `<span class="inline-block animate-spin">⏳</span> ${config.provider === 'openai' ? 'Whisper' : 'AssemblyAI'}...`;
  
  try {
    const res = await fetch(`${API}/api/youtube/videos/${state.currentVideo.id}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        apiKey: config.apiKey,
        provider: config.provider
      })
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

export async function generateBlog() {
  const transcript = document.getElementById('videoTranscript').value.trim();
  if (!transcript || transcript.length < 50) { toast('Önce transkript girin'); return; }
  if (!state.settings.openaiApiKey) { toast('OpenAI API Key gerekli!'); switchPage('settings'); closeModal('video'); return; }
  showLoading('Blog oluşturuluyor...');
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.settings.openaiApiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'YouTube transkriptini Türkçe SEO uyumlu blog yazısına dönüştür. Markdown formatında, 400-800 kelime. Format: BAŞLIK: [başlık]\n---\n[içerik]' },
          { role: 'user', content: `Video: ${state.currentVideo?.title}\n\nTranskript:\n${transcript}` }
        ],
        temperature: 0.7,
        max_tokens: 2500
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const content = data.choices[0].message.content;
    const titleMatch = content.match(/BAŞLIK:\s*(.+)/);
    document.getElementById('blogTitle').value = titleMatch ? titleMatch[1].trim() : state.currentVideo?.title || 'Blog';
    document.getElementById('blogContent').value = content.replace(/BAŞLIK:\s*.+\n---\n?/, '').trim();
    document.getElementById('blogPreview').classList.remove('hidden');
    document.getElementById('saveDraftBtn').classList.remove('hidden');
    document.getElementById('publishBtn').classList.remove('hidden');
    hideLoading();
    toast('Blog oluşturuldu ✓');
  } catch (e) { hideLoading(); toast('Hata: ' + e.message); }
}

export async function saveBlog(status) {
  const title = document.getElementById('blogTitle').value.trim();
  const content = document.getElementById('blogContent').value.trim();
  if (!title || !content) { toast('Başlık ve içerik gerekli'); return; }
  showLoading('Kaydediliyor...');
  
  const res = await fetch(`${API}/api/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      content,
      category: state.currentVideo?.duration <= 60 ? 'Shorts' : 'YouTube',
      thumbnail: state.currentVideo?.thumbnail,
      status,
      videoId: state.currentVideo?.id // Link blog to video
    })
  });
  
  if (res.ok) {
    // Update local state to show blog_created
    if (state.currentVideo) {
      state.currentVideo.blog_created = true;
    }
  }
  
  hideLoading();
  closeModal('video');
  loadVideos(); // Refresh to show blog_created badge
  switchPage('posts');
  loadPosts();
  toast(status === 'published' ? 'Yayınlandı! 🚀' : 'Taslak kaydedildi 📝');
}
