// videos.js - YouTube Videos Management
import { API, YT_API, state } from './config.js';
import { toast, showLoading, hideLoading, openModal } from './utils.js';

export async function loadVideos() {
  try {
    const [v, s] = await Promise.all([
      fetch(`${API}/api/youtube/videos?type=video`),
      fetch(`${API}/api/youtube/videos?type=short`)
    ]);
    state.cachedVideos.video = await v.json();
    state.cachedVideos.short = await s.json();
    renderVideos('video');
    renderVideos('short');
  } catch (e) { console.error(e); }
}

export function startStatusCheck() {
  state.statusCheckInterval = setInterval(checkVideoStatuses, 10000);
}

async function checkVideoStatuses() {
  const processingVideos = [...state.cachedVideos.video, ...state.cachedVideos.short].filter(v =>
    v.transcript_status === 'processing' || v.audio_status === 'processing'
  );
  if (processingVideos.length > 0) {
    await loadVideos();
    if (state.currentVideo) {
      const updated = [...state.cachedVideos.video, ...state.cachedVideos.short].find(v => v.id === state.currentVideo.id);
      if (updated && updated.transcript !== state.currentVideo.transcript) {
        state.currentVideo = updated;
        document.getElementById('videoTranscript').value = updated.transcript || '';
        updateModalBadges();
      }
    }
  }
}

function getStatusBadge(video) {
  const badges = [];
  if (video.audio_status === 'completed') badges.push('<span class="status-badge bg-blue-500 text-white">🎵 MP3</span>');
  else if (video.audio_status === 'processing') badges.push('<span class="status-badge bg-blue-400 text-white"><span class="inline-block animate-spin">⏳</span> MP3</span>');
  if (video.transcript_status === 'completed' && video.transcript) badges.push('<span class="status-badge bg-green-500 text-white" style="right: 50px;">✅ Deşifre</span>');
  else if (video.transcript_status === 'processing') badges.push('<span class="status-badge bg-purple-500 text-white" style="right: 50px;"><span class="inline-block animate-spin">⏳</span> Deşifre</span>');
  else if (video.transcript_status === 'failed') badges.push('<span class="status-badge bg-red-500 text-white" style="right: 50px;">❌ Hata</span>');
  return badges.join('');
}

function renderVideos(type) {
  const container = document.getElementById(type === 'short' ? 'shortsVideosList' : 'youtubeVideosList');
  const videos = state.cachedVideos[type];
  if (!videos?.length) { container.innerHTML = '<p class="col-span-full text-center text-slate-500 p-12 bg-white rounded-xl">Henüz video yok</p>'; return; }
  container.innerHTML = videos.map(v => `
    <div onclick="window.app.openVideoModal('${v.id}')" class="bg-white rounded-xl border overflow-hidden cursor-pointer hover:shadow-lg transition-all">
      <div class="relative">
        <img src="${v.thumbnail}" class="w-full ${type === 'short' ? 'aspect-[9/16]' : 'aspect-video'} object-cover">
        ${getStatusBadge(v)}
      </div>
      <div class="p-3"><h3 class="font-medium line-clamp-2 text-sm">${v.title}</h3></div>
    </div>
  `).join('');
}

export async function fetchAndSaveVideos(type) {
  if (!state.settings.youtubeApiKey) { toast('YouTube API Key gerekli!'); import('./utils.js').then(u => u.switchPage('settings')); return; }
  showLoading('Videolar çekiliyor...');
  try {
    if (!state.settings.channelId) {
      const ch = await fetch(`${YT_API}/search?part=snippet&type=channel&q=@atasa_tr&key=${state.settings.youtubeApiKey}`).then(r => r.json());
      if (ch.items?.[0]) { state.settings.channelId = ch.items[0].snippet.channelId; localStorage.setItem('channelId', state.settings.channelId); }
    }
    const search = await fetch(`${YT_API}/search?part=snippet&channelId=${state.settings.channelId}&maxResults=50&order=date&type=video&key=${state.settings.youtubeApiKey}`).then(r => r.json());
    if (!search.items?.length) { hideLoading(); toast('Video bulunamadı'); return; }
    const ids = search.items.map(i => i.id.videoId).join(',');
    const details = await fetch(`${YT_API}/videos?part=contentDetails,statistics&id=${ids}&key=${state.settings.youtubeApiKey}`).then(r => r.json());
    const videos = search.items.map(i => {
      const d = details.items.find(x => x.id === i.id.videoId);
      const dur = parseDuration(d?.contentDetails?.duration || 'PT0S');
      return { id: i.id.videoId, title: i.snippet.title, description: i.snippet.description, thumbnail: i.snippet.thumbnails.high?.url, duration: dur, viewCount: parseInt(d?.statistics?.viewCount || 0), publishedAt: i.snippet.publishedAt, channelId: state.settings.channelId, type: dur <= 60 ? 'short' : 'video' };
    }).filter(v => type === 'short' ? v.type === 'short' : v.type === 'video');
    await fetch(`${API}/api/youtube/videos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videos }) });
    hideLoading(); loadVideos(); toast(`${videos.length} video kaydedildi ✓`);
  } catch (e) { hideLoading(); toast('Hata: ' + e.message); }
}

function parseDuration(d) { const m = d.match(/PT(\d+H)?(\d+M)?(\d+S)?/); return (parseInt(m[1]) || 0) * 3600 + (parseInt(m[2]) || 0) * 60 + (parseInt(m[3]) || 0); }

export function updateModalBadges() {
  if (!state.currentVideo) return;
  const badges = [];
  if (state.currentVideo.audio_status === 'completed') badges.push('<span class="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700">🎵 MP3 Hazır</span>');
  else if (state.currentVideo.audio_status === 'processing') badges.push('<span class="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700"><span class="inline-block animate-spin">⏳</span> MP3 İşleniyor</span>');
  if (state.currentVideo.transcript_status === 'completed' && state.currentVideo.transcript) badges.push('<span class="px-2 py-1 text-xs rounded bg-green-100 text-green-700">✅ Deşifre Tamam</span>');
  else if (state.currentVideo.transcript_status === 'processing') badges.push('<span class="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700"><span class="inline-block animate-spin">⏳</span> Deşifre Ediliyor</span>');
  else if (state.currentVideo.transcript_status === 'failed') badges.push('<span class="px-2 py-1 text-xs rounded bg-red-100 text-red-700">❌ Hata</span>');
  document.getElementById('modalStatusBadges').innerHTML = badges.join('');
}

export function openVideoModal(id) {
  state.currentVideo = state.cachedVideos.video.find(v => v.id === id) || state.cachedVideos.short.find(v => v.id === id);
  if (!state.currentVideo) return;
  document.getElementById('modalThumb').src = state.currentVideo.thumbnail;
  document.getElementById('modalTitle').textContent = state.currentVideo.title;
  document.getElementById('modalDate').textContent = new Date(state.currentVideo.published_at).toLocaleDateString('tr-TR');
  document.getElementById('videoTranscript').value = state.currentVideo.transcript || '';
  document.getElementById('transcriptStatus').textContent = '';
  document.getElementById('blogPreview').classList.add('hidden');
  document.getElementById('saveDraftBtn').classList.add('hidden');
  document.getElementById('publishBtn').classList.add('hidden');
  updateModalBadges();
  const btn = document.getElementById('transcribeBtn');
  if (state.currentVideo.transcript_status === 'processing') { btn.disabled = true; btn.innerHTML = '<span class="inline-block animate-spin">⏳</span> İşleniyor...'; }
  else if (state.currentVideo.transcript) { btn.disabled = false; btn.textContent = '🔄 Yeniden Deşifre Et'; }
  else { btn.disabled = false; btn.textContent = '🎙️ Deşifre Et'; }
  openModal('video');
}
