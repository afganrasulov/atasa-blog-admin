// features/blog-posts/posts.js - Blog Posts Management
import { API, state } from '../../shared/config.js';
import { toast, showLoading, hideLoading, openModal, closeModal } from '../../shared/utils.js';

export async function loadPosts() {
  try {
    const res = await fetch(`${API}/api/posts/all`);
    state.posts = await res.json();
    renderPosts();
  } catch (e) { console.error(e); }
}

export function setFilter(status) {
  document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('tab-active'));
  document.querySelector(`[data-filter="${status}"]`)?.classList.add('tab-active');
  renderPosts(status);
}

function renderPosts(filter = 'all') {
  const posts = filter === 'all' ? state.posts : state.posts.filter(p => p.status === filter);

  // Stats
  const draft = state.posts.filter(p => p.status === 'draft').length;
  const pub = state.posts.filter(p => p.status === 'published').length;
  const sched = state.posts.filter(p => p.status === 'scheduled').length;
  document.getElementById('draftCount').textContent = draft;
  document.getElementById('publishedCount').textContent = pub;
  document.getElementById('scheduledCount').textContent = sched;
  document.getElementById('totalCount').textContent = state.posts.length;

  document.getElementById('postsList').innerHTML = posts.length ? posts.map(p => `
    <div class="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow">
      <div class="flex gap-4">
        ${p.thumbnail ? `<img src="${p.thumbnail}" class="w-24 h-16 rounded-lg object-cover">` : ''}
        <div class="flex-1">
          <h3 class="font-semibold line-clamp-1">${p.title}</h3>
          <p class="text-sm text-slate-500 mt-1">${p.excerpt || ''}</p>
          <div class="flex gap-2 mt-2">
            <span class="px-2 py-0.5 text-xs rounded ${p.status === 'published' ? 'bg-green-100 text-green-700' : p.status === 'scheduled' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}">${p.status}</span>
            <span class="text-xs text-slate-400">${new Date(p.created_at).toLocaleDateString('tr-TR')}</span>
          </div>
        </div>
        <div class="flex gap-1">
          ${p.status === 'draft' ? `<button onclick="app.publishPost(${p.id})" class="text-sm px-2 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100">Yayınla</button>` : ''}
          ${p.status === 'published' ? `<button onclick="app.unpublishPost(${p.id})" class="text-sm px-2 py-1 bg-yellow-50 text-yellow-600 rounded hover:bg-yellow-100">Geri Al</button>` : ''}
          <button onclick="app.editPost(${p.id})" class="text-sm px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100">✏️</button>
          <button onclick="app.deletePost(${p.id})" class="text-sm px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100">🗑️</button>
        </div>
      </div>
    </div>
  `).join('') : '<p class="text-center text-slate-500 p-8 bg-white rounded-xl border">Henüz yazı yok</p>';
}

export async function publishPost(id) {
  await fetch(`${API}/api/posts/${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'published' }) });
  loadPosts(); toast('Yayınlandı! 🚀');
}

export async function unpublishPost(id) {
  await fetch(`${API}/api/posts/${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'draft' }) });
  loadPosts(); toast('Taslağa alındı');
}

export async function deletePost(id) {
  if (!confirm('Bu yazıyı silmek istediğinize emin misiniz?')) return;
  await fetch(`${API}/api/posts/${id}`, { method: 'DELETE' });
  loadPosts(); toast('Silindi');
}

export async function editPost(id) {
  const post = state.posts.find(p => p.id === id);
  if (!post) return;
  document.getElementById('editPostId').value = post.id;
  document.getElementById('editPostTitle').value = post.title;
  document.getElementById('editPostContent').value = post.content || '';
  document.getElementById('editPostExcerpt').value = post.excerpt || '';
  openModal('edit');
}

export async function savePost() {
  const id = document.getElementById('editPostId').value;
  await fetch(`${API}/api/posts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: document.getElementById('editPostTitle').value,
      content: document.getElementById('editPostContent').value,
      excerpt: document.getElementById('editPostExcerpt').value
    })
  });
  closeModal('edit'); loadPosts(); toast('Güncellendi ✓');
}
