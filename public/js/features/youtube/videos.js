// features/youtube/videos.js - Video loading, rendering, status checks
import { API, YT_API, state } from '../../shared/config.js';
import { toast, showLoading, hideLoading, openModal } from '../../shared/utils.js';
import { selectedVideos, videoFilter, filterVideos } from './selection.js';
import { getBlogSystemPrompt } from '../settings/settings.js';

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

function getStatusBadges(video) {
  const badges = [];
  if (video.blog_created) {
    badges.push('<span class="status-badge bg-emerald-600 text-white" style="top: 8px; left: 8px; right: auto;">📝 Blog</span>');
  }
  if (video.audio_status === 'completed') badges.push('<span class="status-badge bg-blue-500 text-white">🎵 MP3</span>');
  else if (video.audio_status === 'processing') badges.push('<span class="status-badge bg-blue-400 text-white"><span class="inline-block animate-spin">⏳</span> MP3</span>');
  if (video.transcript_status === 'completed' && video.transcript) badges.push('<span class="status-badge bg-green-500 text-white" style="right: 50px;">✅ Deşifre</span>');
  else if (video.transcript_status === 'processing') badges.push('<span class="status-badge bg-purple-500 text-white" style="right: 50px;"><span class="inline-block animate-spin">⏳</span> Deşifre</span>');
  else if (video.transcript_status === 'failed') badges.push('<span class="status-badge bg-red-500 text-white" style="right: 50px;">❌ Hata</span>');
  return badges.join('');
}

export function renderVideos(type) {
  const container = document.getElementById(type === 'short' ? 'shortsVideosList' : 'youtubeVideosList');
  const allVideos = state.cachedVideos[type];
  const videos = filterVideos(allVideos, type);

  if (!allVideos?.length) {
    container.innerHTML = '<p class="col-span-full text-center text-slate-500 p-12 bg-white rounded-xl">Henüz video yok. "Güncelle" butonuna tıklayın.</p>';
    return;
  }

  const totalCount = allVideos.length;
  const blogCount = allVideos.filter(v => v.blog_created).length;
  const transcriptCount = allVideos.filter(v => v.transcript && v.transcript_status === 'completed').length;
  const failedCount = allVideos.filter(v => v.transcript_status === 'failed').length;
  const selectedCount = selectedVideos[type].size;

  const videosHtml = videos.map(v => {
    const isSelected = selectedVideos[type].has(v.id);
    return `
    <div class="bg-white rounded-xl border overflow-hidden hover:shadow-lg transition-all ${isSelected ? 'ring-2 ring-blue-500' : ''}">
      <div class="relative cursor-pointer" onclick="window.app.openVideoModal('${v.id}')">
        <img src="${v.thumbnail}" class="w-full ${type === 'short' ? 'aspect-[9/16]' : 'aspect-video'} object-cover">
        ${getStatusBadges(v)}
      </div>
      <div class="p-3">
        <div class="flex items-start gap-2">
          <input type="checkbox"
            id="select-${v.id}"
            ${isSelected ? 'checked' : ''}
            onclick="event.stopPropagation(); window.app.toggleVideoSelection('${type}', '${v.id}')"
            class="mt-1 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer">
          <label for="select-${v.id}" class="font-medium line-clamp-2 text-sm cursor-pointer flex-1">${v.title}</label>
        </div>
      </div>
    </div>
  `}).join('');

  const toolbar = `
    <div class="col-span-full bg-white rounded-xl border p-4 mb-2">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox"
              ${selectedCount === videos.length && videos.length > 0 ? 'checked' : ''}
              onclick="window.app.toggleSelectAll('${type}')"
              class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500">
            <span class="text-sm font-medium">Tümünü Seç</span>
          </label>
          <span class="text-sm text-slate-500">${selectedCount} seçili</span>
          <span class="text-slate-300">|</span>
          <span class="text-sm text-slate-500">Toplam: ${totalCount}</span>
          <span class="text-sm text-slate-500">Deşifre: ${transcriptCount}</span>
          <span class="text-sm text-slate-500">Blog: ${blogCount}</span>
          ${failedCount > 0 ? `<span class="text-sm text-red-500 font-medium">❌ Hata: ${failedCount}</span>` : ''}
        </div>
        <div class="flex items-center gap-2">
          ${failedCount > 0 ? `
          <button onclick="window.app.retryFailedTranscriptions('${type}')" class="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors">
            🔄 Hatalıları Yeniden Dene (${failedCount})
          </button>` : ''}
          <select onchange="window.app.setVideoFilter('${type}', this.value)" class="px-3 py-1.5 border rounded-lg text-sm">
            <option value="all" ${videoFilter[type] === 'all' ? 'selected' : ''}>Tümü</option>
            <option value="no-blog" ${videoFilter[type] === 'no-blog' ? 'selected' : ''}>Blog Oluşturulmamış</option>
            <option value="with-transcript" ${videoFilter[type] === 'with-transcript' ? 'selected' : ''}>Deşifreli (Blog Yok)</option>
          </select>
        </div>
      </div>
      ${selectedCount > 0 ? `
      <div class="flex gap-2 mt-3 pt-3 border-t">
        <button onclick="window.app.bulkTranscribe('${type}')" class="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
          🎙️ Seçilenleri Deşifre Et (${selectedCount})
        </button>
        <button onclick="window.app.bulkGenerateBlog('${type}')" class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
          📝 Blog Yazısı Oluştur (${selectedCount})
        </button>
        <button onclick="window.app.clearSelection('${type}')" class="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-300">
          ✕ Seçimi Temizle
        </button>
      </div>
      ` : ''}
    </div>
  `;

  const loadMoreBtn = `
    <div class="col-span-full flex justify-center py-4">
      <button onclick="window.app.loadMoreVideos('${type}')" id="loadMore-${type}" class="px-6 py-3 bg-slate-200 hover:bg-slate-300 rounded-xl font-medium transition-colors">
        📥 Daha Fazla Yükle
      </button>
    </div>
  `;

  container.innerHTML = toolbar + videosHtml + loadMoreBtn;
}

export function updateModalBadges() {
  if (!state.currentVideo) return;
  const badges = [];
  if (state.currentVideo.blog_created) badges.push('<span class="px-2 py-1 text-xs rounded bg-emerald-100 text-emerald-700">📝 Blog Oluşturuldu</span>');
  if (state.currentVideo.audio_status === 'completed') badges.push('<span class="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700">🎵 MP3 Hazır</span>');
  else if (state.currentVideo.audio_status === 'processing') badges.push('<span class="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700"><span class="inline-block animate-spin">⏳</span> MP3 İşleniyor</span>');
  if (state.currentVideo.transcript_status === 'completed' && state.currentVideo.transcript) badges.push('<span class="px-2 py-1 text-xs rounded bg-green-100 text-green-700">✅ Deşifre Tamam</span>');
  else if (state.currentVideo.transcript_status === 'processing') badges.push('<span class="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700"><span class="inline-block animate-spin">⏳</span> Deşifre Ediliyor</span>');
  else if (state.currentVideo.transcript_status === 'failed') badges.push('<span class="px-2 py-1 text-xs rounded bg-red-100 text-red-700">❌ Hata</span>');
  document.getElementById('modalStatusBadges').innerHTML = badges.join('');
  updateGenerateBlogButton();
}

function updateGenerateBlogButton() {
  const generateBtn = document.getElementById('generateBlogBtn');
  if (generateBtn && state.currentVideo) {
    const hasTranscript = state.currentVideo.transcript && state.currentVideo.transcript_status === 'completed';
    if (!hasTranscript) {
      generateBtn.textContent = '🤖 Blog Yazısı Oluştur';
      generateBtn.className = 'px-4 py-2 bg-slate-300 text-slate-500 rounded-lg text-sm mb-4 cursor-not-allowed';
      generateBtn.disabled = true;
      generateBtn.title = 'Önce videoyu deşifre edin';
    } else if (state.currentVideo.blog_created) {
      generateBtn.textContent = '🤖 Yeniden Blog Yazısı Oluştur';
      generateBtn.className = 'px-4 py-2 bg-orange-500 text-white rounded-lg text-sm mb-4 hover:bg-orange-600 cursor-pointer';
      generateBtn.disabled = false;
      generateBtn.title = '';
    } else {
      generateBtn.textContent = '🤖 Blog Yazısı Oluştur';
      generateBtn.className = 'px-4 py-2 bg-green-600 text-white rounded-lg text-sm mb-4 hover:bg-green-700 cursor-pointer';
      generateBtn.disabled = false;
      generateBtn.title = '';
    }
  }
}

export async function openVideoModal(id) {
  try {
    const res = await fetch(`${API}/api/youtube/videos/${id}`);
    if (res.ok) {
      state.currentVideo = await res.json();
    } else {
      state.currentVideo = state.cachedVideos.video.find(v => v.id === id) || state.cachedVideos.short.find(v => v.id === id);
    }
  } catch (e) {
    state.currentVideo = state.cachedVideos.video.find(v => v.id === id) || state.cachedVideos.short.find(v => v.id === id);
  }

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

export function parseDuration(d) {
  const m = d.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  return (parseInt(m[1]) || 0) * 3600 + (parseInt(m[2]) || 0) * 60 + (parseInt(m[3]) || 0);
}

export async function reclassifyAllVideos() {
  showLoading('Tüm videolar yeniden sınıflandırılıyor...');
  try {
    const allVideosRes = await fetch(`${API}/api/youtube/videos`);
    const allVideos = await allVideosRes.json();
    if (!allVideos || allVideos.length === 0) { hideLoading(); toast('Veritabanında video bulunamadı'); return; }
    const reclassifyData = allVideos.map(v => ({ id: v.id, type: (v.duration && v.duration <= 60) ? 'short' : 'video' }));
    const toShort = reclassifyData.filter(v => v.type === 'short').length;
    const toVideo = reclassifyData.filter(v => v.type === 'video').length;
    const res = await fetch(`${API}/api/youtube/videos/reclassify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videos: reclassifyData })
    });
    const result = await res.json();
    hideLoading();
    if (result.success) { await loadVideos(); toast(`${result.updated} video güncellendi (${toShort} short, ${toVideo} video) ✓`); }
    else { toast('Hata: ' + (result.error || 'Bilinmeyen hata')); }
  } catch (e) { hideLoading(); toast('Hata: ' + e.message); }
}
