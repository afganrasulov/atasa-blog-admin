// transcription.js - Transcription & Blog Generation
import { API, state } from './config.js';
import { toast, showLoading, hideLoading, closeModal, switchPage } from './utils.js';
import { loadVideos, updateModalBadges } from './videos.js';
import { loadPosts } from './posts.js';

export async function transcribeAll(type) {
  if (!state.settings.assemblyaiApiKey) { toast('AssemblyAI API Key gerekli!'); switchPage('settings'); return; }
  const videos = state.cachedVideos[type].filter(v => !v.transcript && v.transcript_status !== 'processing');
  if (!videos.length) { toast('Deşifre edilecek video yok'); return; }
  toast(`${videos.length} video deşifre edilmeye başlıyor...`);
  for (const video of videos) {
    try {
      await fetch(`${API}/api/youtube/videos/${video.id}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: state.settings.assemblyaiApiKey })
      });
    } catch (e) { console.error('Transcribe error:', e); }
  }
  loadVideos();
  toast('Arka planda işlem başladı ✓');
}

export async function startBackgroundTranscription() {
  if (!state.currentVideo) return;
  if (!state.settings.assemblyaiApiKey) { toast('AssemblyAI API Key gerekli!'); switchPage('settings'); closeModal('video'); return; }
  const btn = document.getElementById('transcribeBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="inline-block animate-spin">⏳</span> Başlatılıyor...';
  try {
    const res = await fetch(`${API}/api/youtube/videos/${state.currentVideo.id}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: state.settings.assemblyaiApiKey })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    toast('Deşifre işlemi başladı ✓ Sayfa kapatılsa bile devam edecek.');
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
  await fetch(`${API}/api/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      content,
      category: state.currentVideo?.duration <= 60 ? 'Shorts' : 'YouTube',
      thumbnail: state.currentVideo?.thumbnail,
      status
    })
  });
  hideLoading();
  closeModal('video');
  switchPage('posts');
  loadPosts();
  toast(status === 'published' ? 'Yayınlandı! 🚀' : 'Taslak kaydedildi 📝');
}
