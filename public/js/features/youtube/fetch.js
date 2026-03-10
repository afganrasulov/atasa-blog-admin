// features/youtube/fetch.js - YouTube API fetching
import { API, YT_API, state } from '../../shared/config.js';
import { toast, showLoading, hideLoading } from '../../shared/utils.js';
import { loadVideos, parseDuration } from './videos.js';

// Pagination state
const pagination = {
    video: { nextPageToken: null, loading: false },
    short: { nextPageToken: null, loading: false }
};

export async function fetchAndSaveVideos(type, maxResults = 50) {
    if (!state.settings.youtubeApiKey) { toast('YouTube API Key gerekli!'); import('../../shared/utils.js').then(u => u.switchPage('settings')); return; }

    showLoading(`Son ${maxResults} video çekiliyor...`);
    pagination[type].nextPageToken = null;

    try {
        if (!state.settings.channelId) {
            const ch = await fetch(`${YT_API}/search?part=snippet&type=channel&q=@atasa_tr&key=${state.settings.youtubeApiKey}`).then(r => r.json());
            if (ch.items?.[0]) { state.settings.channelId = ch.items[0].snippet.channelId; localStorage.setItem('channelId', state.settings.channelId); }
        }

        let allVideos = [];
        let pageToken = null;
        let remaining = maxResults;

        while (remaining > 0) {
            const batchSize = Math.min(remaining, 50);
            let searchUrl = `${YT_API}/search?part=snippet&channelId=${state.settings.channelId}&maxResults=${batchSize}&order=date&type=video&key=${state.settings.youtubeApiKey}`;
            if (pageToken) searchUrl += `&pageToken=${pageToken}`;
            const search = await fetch(searchUrl).then(r => r.json());
            if (!search.items?.length) break;
            const ids = search.items.map(i => i.id.videoId).join(',');
            const details = await fetch(`${YT_API}/videos?part=contentDetails,statistics&id=${ids}&key=${state.settings.youtubeApiKey}`).then(r => r.json());
            const videos = search.items.map(i => {
                const d = details.items.find(x => x.id === i.id.videoId);
                const dur = parseDuration(d?.contentDetails?.duration || 'PT0S');
                return { id: i.id.videoId, title: i.snippet.title, description: i.snippet.description, thumbnail: i.snippet.thumbnails.high?.url, duration: dur, viewCount: parseInt(d?.statistics?.viewCount || 0), publishedAt: i.snippet.publishedAt, channelId: state.settings.channelId, type: dur <= 60 ? 'short' : 'video' };
            });
            allVideos = allVideos.concat(videos);
            pageToken = search.nextPageToken;
            remaining -= batchSize;
            document.getElementById('loadingText').textContent = `${allVideos.length} video çekildi...`;
            if (!pageToken) break;
        }

        pagination[type].nextPageToken = pageToken || null;
        const filteredVideos = allVideos.filter(v => type === 'short' ? v.type === 'short' : v.type === 'video');
        if (filteredVideos.length > 0) {
            await fetch(`${API}/api/youtube/videos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videos: filteredVideos }) });
        }
        hideLoading(); await loadVideos();
        toast(`${filteredVideos.length} ${type === 'short' ? 'shorts' : 'video'} kaydedildi ✓`);
    } catch (e) { hideLoading(); toast('Hata: ' + e.message); }
}

export async function loadMoreVideos(type) {
    if (pagination[type].loading) return;
    const btn = document.getElementById(`loadMore-${type}`);
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="inline-block animate-spin">⏳</span> Yükleniyor...'; }
    pagination[type].loading = true;
    try {
        if (pagination[type].nextPageToken) { await fetchMoreWithToken(type, pagination[type].nextPageToken); }
        else { await fetchAllChannelVideos(type); }
    } finally {
        pagination[type].loading = false;
        if (btn) { btn.disabled = false; btn.innerHTML = '📥 Daha Fazla Yükle'; }
    }
}

async function fetchMoreWithToken(type, pageToken) {
    if (!state.settings.youtubeApiKey) { toast('YouTube API Key gerekli!'); return; }
    showLoading('Daha fazla video çekiliyor...');
    try {
        let searchUrl = `${YT_API}/search?part=snippet&channelId=${state.settings.channelId}&maxResults=50&order=date&type=video&key=${state.settings.youtubeApiKey}&pageToken=${pageToken}`;
        const search = await fetch(searchUrl).then(r => r.json());
        if (!search.items?.length) { hideLoading(); toast('Daha fazla video yok'); return; }
        pagination[type].nextPageToken = search.nextPageToken || null;
        const ids = search.items.map(i => i.id.videoId).join(',');
        const details = await fetch(`${YT_API}/videos?part=contentDetails,statistics&id=${ids}&key=${state.settings.youtubeApiKey}`).then(r => r.json());
        const videos = search.items.map(i => {
            const d = details.items.find(x => x.id === i.id.videoId);
            const dur = parseDuration(d?.contentDetails?.duration || 'PT0S');
            return { id: i.id.videoId, title: i.snippet.title, description: i.snippet.description, thumbnail: i.snippet.thumbnails.high?.url, duration: dur, viewCount: parseInt(d?.statistics?.viewCount || 0), publishedAt: i.snippet.publishedAt, channelId: state.settings.channelId, type: dur <= 60 ? 'short' : 'video' };
        }).filter(v => type === 'short' ? v.type === 'short' : v.type === 'video');
        if (videos.length > 0) {
            await fetch(`${API}/api/youtube/videos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videos }) });
        }
        hideLoading(); await loadVideos(); toast(`+${videos.length} video eklendi ✓`);
    } catch (e) { hideLoading(); toast('Hata: ' + e.message); }
}

async function fetchAllChannelVideos(type) {
    if (!state.settings.youtubeApiKey) { toast('YouTube API Key gerekli!'); return; }
    showLoading('Tüm videolar çekiliyor...');
    try {
        if (!state.settings.channelId) {
            const ch = await fetch(`${YT_API}/search?part=snippet&type=channel&q=@atasa_tr&key=${state.settings.youtubeApiKey}`).then(r => r.json());
            if (ch.items?.[0]) { state.settings.channelId = ch.items[0].snippet.channelId; localStorage.setItem('channelId', state.settings.channelId); }
        }
        let allVideos = []; let pageToken = null; let pageCount = 0; const maxPages = 10;
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
                return { id: i.id.videoId, title: i.snippet.title, description: i.snippet.description, thumbnail: i.snippet.thumbnails.high?.url, duration: dur, viewCount: parseInt(d?.statistics?.viewCount || 0), publishedAt: i.snippet.publishedAt, channelId: state.settings.channelId, type: dur <= 60 ? 'short' : 'video' };
            });
            allVideos = allVideos.concat(videos); pageToken = search.nextPageToken; pageCount++;
            document.getElementById('loadingText').textContent = `${allVideos.length} video çekildi...`;
        } while (pageToken && pageCount < maxPages);
        const filteredVideos = allVideos.filter(v => type === 'short' ? v.type === 'short' : v.type === 'video');
        if (filteredVideos.length > 0) {
            await fetch(`${API}/api/youtube/videos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ videos: filteredVideos }) });
        }
        hideLoading(); await loadVideos();
        toast(`Toplam ${filteredVideos.length} ${type === 'short' ? 'shorts' : 'video'} kaydedildi ✓`);
    } catch (e) { hideLoading(); toast('Hata: ' + e.message); }
}
