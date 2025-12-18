// utils.js - Utility functions

export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('translate-y-20', 'opacity-0');
  setTimeout(() => t.classList.add('translate-y-20', 'opacity-0'), 3000);
}

export function showLoading(text) {
  document.getElementById('loadingText').textContent = text;
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('loading').classList.add('flex');
}

export function hideLoading() {
  document.getElementById('loading').classList.add('hidden');
  document.getElementById('loading').classList.remove('flex');
}

export function openModal(name) {
  document.getElementById(name + 'Modal').classList.remove('hidden');
  document.getElementById(name + 'Modal').classList.add('flex');
}

export function closeModal(name) {
  document.getElementById(name + 'Modal').classList.add('hidden');
  document.getElementById(name + 'Modal').classList.remove('flex');
}

export function switchPage(page) {
  ['posts', 'youtube', 'shorts', 'settings'].forEach(p => {
    document.getElementById(p + 'Page').classList.toggle('hidden', p !== page);
    document.getElementById('page-' + p).classList.toggle('page-active', p === page);
  });
}

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal('edit');
    closeModal('video');
    closeModal('addUser');
  }
});
