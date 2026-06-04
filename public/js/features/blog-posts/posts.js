// features/blog-posts/posts.js - Blog Posts Management
import { API, state } from '../../shared/config.js';
import { toast, showLoading, hideLoading, openModal, closeModal } from '../../shared/utils.js';

let mde = null;

function initEditor() {
  if (mde) return mde;
  const el = document.getElementById('editContent');
  if (!el || typeof EasyMDE === 'undefined') return null;

  mde = new EasyMDE({
    element: el,
    spellChecker: false,
    autofocus: false,
    placeholder: 'İçeriği buraya yazın. Resim sürükle-bırak veya yapıştır ile yüklenir.',
    minHeight: '320px',
    status: ['lines', 'words'],
    toolbar: [
      'bold', 'italic', 'heading', '|',
      'quote', 'unordered-list', 'ordered-list', '|',
      'link', 'image', 'upload-image', '|',
      'preview', 'side-by-side', 'fullscreen', '|',
      'guide'
    ],
    uploadImage: true,
    imageMaxSize: 8 * 1024 * 1024,
    imageAccept: 'image/jpeg, image/png, image/webp, image/gif',
    imageTexts: {
      sbInit: '📷 Resim sürükle-bırak, yapıştır veya tıkla.',
      sbOnDragEnter: 'Bırak yüklensin',
      sbOnDrop: 'Yükleniyor #images_names#',
      sbProgress: 'Yükleniyor #file_name#: #progress#%',
      sbOnUploaded: 'Yüklendi: #image_name#',
      sizeUnits: ' B, KB, MB',
    },
    errorMessages: {
      noFileGiven: 'Bir dosya seçmelisiniz.',
      typeNotAllowed: 'Bu dosya türü desteklenmiyor (#image_type#).',
      fileTooLarge: 'Dosya çok büyük: #image_size# (limit: #image_max_size#).',
      importError: 'Yükleme hatası.',
    },
    imageUploadFunction: async (file, onSuccess, onError) => {
      try {
        const fd = new FormData();
        fd.append('image', file);
        const res = await fetch(`${API}/api/blog/upload/image`, { method: 'POST', body: fd });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        onSuccess(data.url);
      } catch (e) {
        onError(e.message);
      }
    },
    previewRender: (md) => simpleMarkdownPreview(md),
  });

  return mde;
}

function simpleMarkdownPreview(md) {
  // Lightweight preview matching atasa.tr's renderContent semantics
  if (!md) return '<p class="text-slate-400">Önizleme boş…</p>';
  let html = md
    .replace(/^# (.+)$/gm, '<h2 class="text-2xl font-bold mt-6 mb-3 text-slate-900">$1</h2>')
    .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold mt-6 mb-3 text-slate-900">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="text-xl font-semibold mt-4 mb-2 text-slate-800">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+?)\*/g, '<em>$1</em>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="rounded-lg my-4 max-w-full">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 underline" target="_blank">$1</a>')
    .replace(/^[*-] (.+)$/gm, '<li class="ml-6 list-disc">$1</li>')
    .replace(/(<li[^>]*>.*?<\/li>\n?)+/gs, (m) => `<ul class="my-2">${m}</ul>`)
    .replace(/\n\n+/g, '</p><p class="my-3 text-slate-700 leading-relaxed">')
    .replace(/^(?!<[hupol])(.+)$/gm, '<p class="my-3 text-slate-700 leading-relaxed">$1</p>');
  return html;
}

function getEditorValue() {
  return mde ? mde.value() : document.getElementById('editContent').value;
}

function setEditorValue(v) {
  if (mde) mde.value(v || '');
  else document.getElementById('editContent').value = v || '';
}

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
          ${p.status === 'draft' ? `<button onclick="app.publishPost('${p.id}')" class="text-sm px-2 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100">Yayınla</button>` : ''}
          ${p.status === 'published' ? `<button onclick="app.unpublishPost('${p.id}')" class="text-sm px-2 py-1 bg-yellow-50 text-yellow-600 rounded hover:bg-yellow-100">Geri Al</button>` : ''}
          <button onclick="app.editPost('${p.id}')" class="text-sm px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100">✏️</button>
          <button onclick="app.deletePost('${p.id}')" class="text-sm px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100">🗑️</button>
        </div>
      </div>
    </div>
  `).join('') : '<p class="text-center text-slate-500 p-8 bg-white rounded-xl border">Henüz yazı yok</p>';
}

export async function publishPost(id) {
  await fetch(`${API}/api/posts/${id}/publish`, { method: 'PUT' });
  loadPosts(); toast('Yayınlandı! 🚀');
}

export async function unpublishPost(id) {
  await fetch(`${API}/api/posts/${id}/unpublish`, { method: 'PUT' });
  loadPosts(); toast('Taslağa alındı');
}

export async function deletePost(id) {
  if (!confirm('Bu yazıyı silmek istediğinize emin misiniz?')) return;
  await fetch(`${API}/api/posts/${id}`, { method: 'DELETE' });
  loadPosts(); toast('Silindi');
}

export function newPost() {
  document.getElementById('editId').value = '';
  document.getElementById('editTitle').value = '';
  document.getElementById('editCategory').value = 'Genel';
  document.getElementById('editAuthor').value = state.currentUser?.name || '';
  document.getElementById('editExcerpt').value = '';
  setEditorValue('');
  document.getElementById('editThumbnail').value = '';
  document.getElementById('editPublishNow').checked = false;
  document.getElementById('editModalTitle').textContent = '✍️ Yeni Yazı';
  document.getElementById('btnSavePost').textContent = 'Kaydet';
  openModal('edit');
  setTimeout(() => initEditor(), 50);
}

export async function editPost(id) {
  const post = state.posts.find(p => p.id == id);
  if (!post) return;
  document.getElementById('editId').value = post.id;
  document.getElementById('editTitle').value = post.title;
  document.getElementById('editCategory').value = post.category || 'Genel';
  document.getElementById('editAuthor').value = post.author || '';
  document.getElementById('editExcerpt').value = post.excerpt || '';
  document.getElementById('editThumbnail').value = post.thumbnail || '';
  document.getElementById('editPublishNow').checked = post.status === 'published';
  document.getElementById('editModalTitle').textContent = 'Düzenle';
  document.getElementById('btnSavePost').textContent = 'Kaydet';
  openModal('edit');
  setTimeout(() => {
    initEditor();
    setEditorValue(post.content || '');
  }, 50);
}

export async function savePost() {
  const id = document.getElementById('editId').value;
  const title = document.getElementById('editTitle').value.trim();
  const content = getEditorValue().trim();

  if (!title || !content) {
    toast('Başlık ve içerik zorunlu');
    return;
  }

  const publishNow = document.getElementById('editPublishNow').checked;
  const body = {
    title,
    content,
    category: document.getElementById('editCategory').value.trim() || 'Genel',
    author: document.getElementById('editAuthor').value.trim() || 'Admin',
    excerpt: document.getElementById('editExcerpt').value.trim(),
    thumbnail: document.getElementById('editThumbnail').value.trim(),
    status: publishNow ? 'published' : 'draft'
  };

  const btn = document.getElementById('btnSavePost');
  btn.disabled = true;
  const originalText = btn.textContent;
  btn.textContent = 'Kaydediliyor...';

  try {
    const isNew = !id;
    const res = await fetch(`${API}/api/posts${isNew ? '' : '/' + id}`, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Kayıt başarısız');
    }
    closeModal('edit');
    loadPosts();
    toast(isNew ? (publishNow ? 'Yayınlandı! 🚀' : 'Taslak kaydedildi ✓') : 'Güncellendi ✓');
  } catch (e) {
    toast('❌ ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

export async function buildAllInternalLinks() {
  if (!confirm('Tüm blog yazılarına AI ile iç bağlantılar kurulsun mu?\nBu işlem birkaç dakika sürebilir.')) return;

  const btn = document.getElementById('btnBuildLinks');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ İşleniyor...';
  btn.classList.add('opacity-50', 'cursor-not-allowed');

  toast('🔗 AI iç bağlantı kurma başladı...');

  try {
    const res = await fetch(`${API}/api/posts/build-all-internal-links`, { method: 'POST' });
    const data = await res.json();

    if (data.success) {
      toast(`✅ ${data.updated}/${data.total} yazıya toplam ${data.totalLinks} iç bağlantı eklendi!`);
      if (data.errors?.length > 0) {
        console.warn('İç bağlantı hataları:', data.errors);
        toast(`⚠️ ${data.errors.length} yazıda hata oluştu`);
      }
      loadPosts();
    } else {
      toast('❌ İç bağlantı kurulurken hata oluştu');
    }
  } catch (e) {
    console.error(e);
    toast('❌ İç bağlantı kurulurken hata: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
    btn.classList.remove('opacity-50', 'cursor-not-allowed');
  }
}
