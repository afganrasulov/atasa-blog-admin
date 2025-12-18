// videos.js - YouTube Videos Management
import { API, YT_API, state } from './config.js';
import { toast, showLoading, hideLoading, openModal } from './utils.js';

// Pagination and selection state
const pagination = {
  video: { nextPageToken: null, loading: false },
  short: { nextPageToken: null, loading: false }
};

// Selected videos for bulk operations
export const selectedVideos = {
  video: new Set(),
  short: new Set()
};

// Filter state
export const videoFilter = {
  video: 'all', // 'all', 'no-blog', 'with-transcript'
  short: 'all'
};

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

function getStatusBadges(video) {
  const badges = [];
  
  // Blog created badge (top priority)
  if (video.blog_created) {
    badges.push('<span class="status-badge bg-emerald-600 text-white" style="top: 8px; left: 8px; right: auto;">📝 Blog</span>');
  }
  
  // Audio status
  if (video.audio_status === 'completed') badges.push('<span class="status-badge bg-blue-500 text-white">🎵 MP3</span>');
  else if (video.audio_status === 'processing') badges.push('<span class="status-badge bg-blue-400 text-white"><span class="inline-block animate-spin">⏳</span> MP3</span>');
  
  // Transcript status
  if (video.transcript_status === 'completed' && video.transcript) badges.push('<span class="status-badge bg-green-500 text-white" style="right: 50px;">✅ Deşifre</span>');
  else if (video.transcript_status === 'processing') badges.push('<span class="status-badge bg-purple-500 text-white" style="right: 50px;"><span class="inline-block animate-spin">⏳</span> Deşifre</span>');
  else if (video.transcript_status === 'failed') badges.push('<span class="status-badge bg-red-500 text-white" style="right: 50px;">❌ Hata</span>');
  
  return badges.join('');
}

function filterVideos(videos, type) {
  const filter = videoFilter[type];
  if (filter === 'all') return videos;
  if (filter === 'no-blog') return videos.filter(v => !v.blog_created);
  if (filter === 'with-transcript') return videos.filter(v => v.transcript && v.transcript_status === 'completed' && !v.blog_created);
  return videos;
}

function renderVideos(type) {
  const container = document.getElementById(type === 'short' ? 'shortsVideosList' : 'youtubeVideosList');
  const allVideos = state.cachedVideos[type];
  const videos = filterVideos(allVideos, type);
  
  if (!allVideos?.length) { 
    container.innerHTML = '<p class="col-span-full text-center text-slate-500 p-12 bg-white rounded-xl">Henüz video yok. "Güncelle" butonuna tıklayın.</p>'; 
    return; 
  }
  
  // Stats
  const totalCount = allVideos.length;
  const blogCount = allVideos.filter(v => v.blog_created).length;
  const transcriptCount = allVideos.filter(v => v.transcript && v.transcript_status === 'completed').length;
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
  
  // Selection toolbar
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
        </div>
        <div class="flex items-center gap-2">
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
  
  // Load more button
  const loadMoreBtn = `
    <div class="col-span-full flex justify-center py-4">
      <button onclick="window.app.loadMoreVideos('${type}')" id="loadMore-${type}" class="px-6 py-3 bg-slate-200 hover:bg-slate-300 rounded-xl font-medium transition-colors">
        📥 Daha Fazla Yükle
      </button>
    </div>
  `;
  
  container.innerHTML = toolbar + videosHtml + loadMoreBtn;
}

// Selection functions
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
  selectedVideos[type].clear(); // Clear selection when filter changes
  renderVideos(type);
}

// Bulk operations
export async function bulkTranscribe(type) {
  const ids = Array.from(selectedVideos[type]);
  if (ids.length === 0) { toast('Video seçin'); return; }
  
  const config = getTranscriptionConfig();
  if (!config) return;
  
  toast(`${ids.length} video deşifre edilmeye başlıyor...`);
  
  try {
    await fetch(`${API}/api/youtube/videos/bulk-transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoIds: ids,
        apiKey: config.apiKey,
        provider: config.provider
      })
    });
    
    selectedVideos[type].clear();
    loadVideos();
    toast(`${ids.length} video için deşifre başlatıldı ✓`);
  } catch (e) {
    toast('Hata: ' + e.message);
  }
}

export async function bulkGenerateBlog(type) {
  const ids = Array.from(selectedVideos[type]);
  if (ids.length === 0) { toast('Video seçin'); return; }
  
  // Filter only videos with transcripts
  const videosWithTranscript = ids.filter(id => {
    const video = state.cachedVideos[type].find(v => v.id === id);
    return video && video.transcript && video.transcript_status === 'completed';
  });
  
  if (videosWithTranscript.length === 0) {
    toast('Seçili videolarda deşifre bulunamadı. Önce deşifre edin.');
    return;
  }
  
  // Check for videos that already have blogs
  const videosWithBlog = videosWithTranscript.filter(id => {
    const video = state.cachedVideos[type].find(v => v.id === id);
    return video && video.blog_created;
  });
  
  if (videosWithBlog.length > 0) {
    const confirmMsg = videosWithBlog.length === videosWithTranscript.length
      ? `Seçili ${videosWithBlog.length} videonun tamamı için zaten blog oluşturulmuş. Yine de devam etmek istiyor musunuz?`
      : `Seçili ${videosWithTranscript.length} videodan ${videosWithBlog.length} tanesi için zaten blog oluşturulmuş. Devam etmek istiyor musunuz?`;
    
    if (!confirm(confirmMsg)) {
      return;
    }
  }
  
  if (!state.settings.openaiApiKey) {
    toast('OpenAI API Key gerekli!');
    import('./utils.js').then(u => u.switchPage('settings'));
    return;
  }
  
  showLoading(`${videosWithTranscript.length} video için blog oluşturuluyor...`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const videoId of videosWithTranscript) {
    const video = state.cachedVideos[type].find(v => v.id === videoId);
    if (!video) continue;
    
    try {
      document.getElementById('loadingText').textContent = `Blog oluşturuluyor: ${video.title.substring(0, 30)}...`;
      
      // Generate blog content
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${state.settings.openaiApiKey}` 
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'YouTube transkriptini Türkçe SEO uyumlu blog yazısına dönüştür. Markdown formatında, 400-800 kelime. Format: BAŞLIK: [başlık]\n---\n[içerik]' },
            { role: 'user', content: `Video: ${video.title}\n\nTranskript:\n${video.transcript}` }
          ],
          temperature: 0.7,
          max_tokens: 2500
        })
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      
      const content = data.choices[0].message.content;
      const titleMatch = content.match(/BAŞLIK:\s*(.+)/);
      const blogTitle = titleMatch ? titleMatch[1].trim() : video.title;
      const blogContent = content.replace(/BAŞLIK:\s*.+\n---\n?/, '').trim();
      
      // Save blog post
      const postRes = await fetch(`${API}/api/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: blogTitle,
          content: blogContent,
          category: video.duration <= 60 ? 'Shorts' : 'YouTube',
          thumbnail: video.thumbnail,
          status: 'draft',
          videoId: video.id
        })
      });
      
      if (postRes.ok) {
        successCount++;
      } else {
        failCount++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 1000));
      
    } catch (e) {
      console.error(`Blog creation failed for ${videoId}:`, e);
      failCount++;
    }
  }
  
  hideLoading();
  selectedVideos[type].clear();
  loadVideos();
  
  if (failCount === 0) {
    toast(`${successCount} blog yazısı oluşturuldu ✓`);
  } else {
    toast(`${successCount} başarılı, ${failCount} başarısız`);
  }
}

function getTranscriptionConfig() {
  const provider = state.settings.transcriptionProvider || 'openai';
  let apiKey;
  
  if (provider === 'openai') {
    apiKey = state.settings.openaiApiKey;
    if (!apiKey) {
      toast('OpenAI API Key gerekli!');
      import('./utils.js').then(u => u.switchPage('settings'));
      return null;
    }
  } else {
    apiKey = state.settings.assemblyaiApiKey;
    if (!apiKey) {
      toast('AssemblyAI API Key gerekli!');
      import('./utils.js').then(u => u.switchPage('settings'));
      return null;
    }
  }
  
  return { provider, apiKey };
}

export async function fetchAndSaveVideos(type, pageToken = null) {
  if (!state.settings.youtubeApiKey) { toast('YouTube API Key gerekli!'); import('./utils.js').then(u => u.switchPage('settings')); return; }
  
  if (!pageToken) {
    showLoading('Videolar çekiliyor...');
    pagination[type].nextPageToken = null;
  }
  
  try {
    if (!state.settings.channelId) {
      const ch = await fetch(`${YT_API}/search?part=snippet&type=channel&q=@atasa_tr&key=${state.settings.youtubeApiKey}`).then(r => r.json());
      if (ch.items?.[0]) { 
        state.settings.channelId = ch.items[0].snippet.channelId; 
        localStorage.setItem('channelId', state.settings.channelId); 
      }
    }
    
    let searchUrl = `${YT_API}/search?part=snippet&channelId=${state.settings.channelId}&maxResults=50&order=date&type=video&key=${state.settings.youtubeApiKey}`;
    if (pageToken) searchUrl += `&pageToken=${pageToken}`;
    
    const search = await fetch(searchUrl).then(r => r.json());
    
    if (!search.items?.length) { 
      hideLoading(); 
      toast(pageToken ? 'Daha fazla video yok' : 'Video bulunamadı'); 
      return; 
    }
    
    pagination[type].nextPageToken = search.nextPageToken || null;
    
    const ids = search.items.map(i => i.id.videoId).join(',');
    const details = await fetch(`${YT_API}/videos?part=contentDetails,statistics&id=${ids}&key=${state.settings.youtubeApiKey}`).then(r => r.json());
    
    const videos = search.items.map(i => {
      const d = details.items.find(x => x.id === i.id.videoId);
      const dur = parseDuration(d?.contentDetails?.duration || 'PT0S');
      return { 
        id: i.id.videoId, 
        title: i.snippet.title, 
        description: i.snippet.description, 
        thumbnail: i.snippet.thumbnails.high?.url, 
        duration: dur, 
        viewCount: parseInt(d?.statistics?.viewCount || 0), 
        publishedAt: i.snippet.publishedAt, 
        channelId: state.settings.channelId, 
        type: dur <= 60 ? 'short' : 'video' 
      };
    }).filter(v => type === 'short' ? v.type === 'short' : v.type === 'video');
    
    if (videos.length > 0) {
      await fetch(`${API}/api/youtube/videos`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ videos }) 
      });
    }
    
    hideLoading(); 
    await loadVideos(); 
    
    const totalMsg = pageToken ? `+${videos.length} video eklendi` : `${videos.length} video kaydedildi`;
    toast(`${totalMsg} ✓ ${pagination[type].nextPageToken ? '(Daha fazla var)' : '(Tümü yüklendi)'}`);
    
  } catch (e) { 
    hideLoading(); 
    toast('Hata: ' + e.message); 
  }
}

export async function loadMoreVideos(type) {
  if (pagination[type].loading) return;
  
  const btn = document.getElementById(`loadMore-${type}`);
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="inline-block animate-spin">⏳</span> Yükleniyor...';
  }
  
  pagination[type].loading = true;
  
  try {
    if (pagination[type].nextPageToken) {
      await fetchAndSaveVideos(type, pagination[type].nextPageToken);
    } else {
      await fetchAllChannelVideos(type);
    }
  } finally {
    pagination[type].loading = false;
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '📥 Daha Fazla Yükle';
    }
  }
}

async function fetchAllChannelVideos(type) {
  if (!state.settings.youtubeApiKey) { toast('YouTube API Key gerekli!'); return; }
  
  showLoading('Tüm videolar çekiliyor...');
  
  try {
    if (!state.settings.channelId) {
      const ch = await fetch(`${YT_API}/search?part=snippet&type=channel&q=@atasa_tr&key=${state.settings.youtubeApiKey}`).then(r => r.json());
      if (ch.items?.[0]) { 
        state.settings.channelId = ch.items[0].snippet.channelId; 
        localStorage.setItem('channelId', state.settings.channelId); 
      }
    }
    
    let allVideos = [];
    let pageToken = null;
    let pageCount = 0;
    const maxPages = 10;
    
    do {
      let searchUrl = `${YT_API}/search?part=snippet&channelId=${state.settings.channelId}&maxResults=50&order=date&type=video&key=${state.settings.youtubeApiKey}`;
      if (pageToken) searchUrl += `&pageToken=${pageToken}`;
      
      const search = await fetch(searchUrl).then(r => r.json());
      
      if (!search.items?.length) break;
      
      const ids = search.items.map(i => i.id.videoId).join(',');
      const details = await fetch(`${YT_API}/videos?part=contentDetails,statistics&id=${ids}&key=${state.settings.youtubeApiKey}`).then(r => r.json());
      
      const videos = search.items.map(i => {
        const d = details.items.find(x => x.id === i.id.videoId);
        const dur = parseDuration(d?.contentDetails?.duration || 'PT0S');
        return { 
          id: i.id.videoId, 
          title: i.snippet.title, 
          description: i.snippet.description, 
          thumbnail: i.snippet.thumbnails.high?.url, 
          duration: dur, 
          viewCount: parseInt(d?.statistics?.viewCount || 0), 
          publishedAt: i.snippet.publishedAt, 
          channelId: state.settings.channelId, 
          type: dur <= 60 ? 'short' : 'video' 
        };
      });
      
      allVideos = allVideos.concat(videos);
      pageToken = search.nextPageToken;
      pageCount++;
      
      document.getElementById('loadingText').textContent = `${allVideos.length} video çekildi...`;
      
    } while (pageToken && pageCount < maxPages);
    
    const filteredVideos = allVideos.filter(v => type === 'short' ? v.type === 'short' : v.type === 'video');
    
    if (filteredVideos.length > 0) {
      await fetch(`${API}/api/youtube/videos`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ videos: filteredVideos }) 
      });
    }
    
    hideLoading();
    await loadVideos();
    toast(`Toplam ${filteredVideos.length} ${type === 'short' ? 'shorts' : 'video'} kaydedildi ✓`);
    
  } catch (e) {
    hideLoading();
    toast('Hata: ' + e.message);
  }
}

function parseDuration(d) { 
  const m = d.match(/PT(\d+H)?(\d+M)?(\d+S)?/); 
  return (parseInt(m[1]) || 0) * 3600 + (parseInt(m[2]) || 0) * 60 + (parseInt(m[3]) || 0); 
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
  
  // Update generate blog button
  updateGenerateBlogButton();
}

function updateGenerateBlogButton() {
  const generateBtn = document.getElementById('generateBlogBtn');
  if (generateBtn && state.currentVideo) {
    if (state.currentVideo.blog_created) {
      generateBtn.textContent = '🤖 Yeniden Blog Yazısı Oluştur';
      generateBtn.className = 'px-4 py-2 bg-orange-500 text-white rounded-lg text-sm mb-4 hover:bg-orange-600';
    } else {
      generateBtn.textContent = '🤖 Blog Yazısı Oluştur';
      generateBtn.className = 'px-4 py-2 bg-green-600 text-white rounded-lg text-sm mb-4 hover:bg-green-700';
    }
  }
}

export async function openVideoModal(id) {
  // Fetch fresh data from API to ensure blog_created is up to date
  try {
    const res = await fetch(`${API}/api/youtube/videos/${id}`);
    if (res.ok) {
      state.currentVideo = await res.json();
    } else {
      // Fallback to cache
      state.currentVideo = state.cachedVideos.video.find(v => v.id === id) || state.cachedVideos.short.find(v => v.id === id);
    }
  } catch (e) {
    // Fallback to cache on error
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
