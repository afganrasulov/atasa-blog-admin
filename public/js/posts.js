// posts.js - Blog Posts Management
import { API, state } from './config.js';
import { toast, openModal, closeModal } from './utils.js';

export async function loadPosts() {
  const res = await fetch(`${API}/api/posts/all`);
  state.posts = await res.json();
  document.getElementById('draftCount').textContent = state.posts.filter(p => p.status === 'draft').length;
  document.getElementById('publishedCount').textContent = state.posts.filter(p => p.status === 'published').length;
  document.getElementById('scheduledCount').textContent = state.posts.filter(p => p.status === 'scheduled').length;
  document.getElementById('totalCount').textContent = state.posts.length;
  renderPosts();
}

export function setFilter(f) {
  state.currentFilter = f;
  document.querySelectorAll('[id^="tab-"]').forEach(t => t.classList.toggle('tab-active', t.id === 'tab-' + f));
  renderPosts();
}

function renderPosts() {
  const list = document.getElementById('postsList');
  const filtered = state.currentFilter === 'all' ? state.posts : state.posts.filter(p => p.status === state.currentFilter);
  if (!filtered.length) { list.innerHTML = '<p class="p-8 text-center text-slate-500">Yazı yok</p>'; return; }
  list.innerHTML = filtered.map(p => `
    <div class="p-4 flex gap-4 hover:bg-slate-50">
      <img src="${p.thumbnail || 'https://via.placeholder.com/80'}" class="w-20 h-20 rounded-lg object-cover">
      <div class="flex-1">
        <span class="px-2 py-0.5 text-xs rounded-full ${p.status === 'published' ? 'bg-green-100 text-green-700' : p.status === 'scheduled' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}">${p.status}</span>
        <h3 class="font-semibold mt-1">${p.title}</h3>
        <p class="text-sm text-slate-500">${p.category} • ${p.date}</p>
      </div>
      <div class="flex gap-1">
        ${p.status === 'draft' ? `<button onclick="window.app.publishPost('${p.id}')" class="p-2 hover:bg-green-100 text-green-600 rounded">✓</button>` : ''}
        ${p.status === 'published' ? `<button onclick="window.app.unpublishPost('${p.id}')" class="p-2 hover:bg-yellow-100 text-yellow-600 rounded">↩</button>` : ''}
        <button onclick="window.app.editPost('${p.id}')" class="p-2 hover:bg-slate-100 rounded">✏️</button>
        <button onclick="window.app.deletePost('${p.id}')" class="p-2 hover:bg-red-100 text-red-600 rounded">🗑️</button>
      </div>
    </div>
  `).join('');
}

export async function publishPost(id) {
  await fetch(`${API}/api/posts/${id}/publish`, { method: 'PUT' });
  loadPosts();
  toast('Yayınlandı');
}

export async function unpublishPost(id) {
  await fetch(`${API}/api/posts/${id}/unpublish`, { method: 'PUT' });
  loadPosts();
  toast('Taslağa alındı');
}

export async function deletePost(id) {
  if (!confirm('Silmek istediğinize emin misiniz?')) return;
  await fetch(`${API}/api/posts/${id}`, { method: 'DELETE' });
  loadPosts();
  toast('Silindi');
}

export function editPost(id) {
  const p = state.posts.find(x => x.id === id);
  document.getElementById('editId').value = p.id;
  document.getElementById('editTitle').value = p.title;
  document.getElementById('editCategory').value = p.category;
  document.getElementById('editExcerpt').value = p.excerpt || '';
  document.getElementById('editContent').value = p.content;
  document.getElementById('editThumbnail').value = p.thumbnail;
  openModal('edit');
}

export async function savePost() {
  const id = document.getElementById('editId').value;
  await fetch(`${API}/api/posts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: document.getElementById('editTitle').value,
      category: document.getElementById('editCategory').value,
      excerpt: document.getElementById('editExcerpt').value,
      content: document.getElementById('editContent').value,
      thumbnail: document.getElementById('editThumbnail').value
    })
  });
  closeModal('edit');
  loadPosts();
  toast('Güncellendi');
}
