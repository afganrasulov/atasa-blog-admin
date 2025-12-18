// auth.js - Authentication & User Management
import { API, GOOGLE_CLIENT_ID, state } from './config.js';
import { toast } from './utils.js';
import { loadPosts } from './posts.js';
import { loadVideos, startStatusCheck } from './videos.js';
import { loadSettings } from './settings.js';

export function initAuth() {
  google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleLogin });
  const saved = localStorage.getItem('adminUser');
  if (saved) {
    state.currentUser = JSON.parse(saved);
    showApp();
  } else {
    showLogin();
  }
}

export function showLogin() {
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('mainApp').classList.add('hidden');
  google.accounts.id.renderButton(document.getElementById('googleLoginBtn'), { theme: 'outline', size: 'large', width: 280 });
}

export function showApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
  if (state.currentUser?.picture) document.getElementById('userAvatar').src = state.currentUser.picture;
  loadSettings();
  loadPosts();
  loadVideos();
  loadUsers();
  startStatusCheck();
}

async function handleLogin(response) {
  const jwt = JSON.parse(atob(response.credential.split('.')[1]));
  const res = await fetch(`${API}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: jwt.email })
  });
  const data = await res.json();
  if (data.allowed) {
    state.currentUser = { email: jwt.email, name: jwt.name, picture: jwt.picture };
    localStorage.setItem('adminUser', JSON.stringify(state.currentUser));
    showApp();
    toast(`Hoş geldin, ${jwt.given_name}! 👋`);
  } else {
    document.getElementById('loginError').textContent = 'Giriş izniniz yok.';
    document.getElementById('loginError').classList.remove('hidden');
  }
}

export function logout() {
  state.currentUser = null;
  localStorage.removeItem('adminUser');
  google.accounts.id.disableAutoSelect();
  if (state.statusCheckInterval) clearInterval(state.statusCheckInterval);
  showLogin();
}

// User Management
export async function loadUsers() {
  const res = await fetch(`${API}/api/auth/users`);
  const users = await res.json();
  document.getElementById('allowedUsersList').innerHTML = users.length ? users.map(u => `
    <div class="flex justify-between items-center p-2 bg-slate-50 rounded">
      <span>${u.email}${u.name ? ` (${u.name})` : ''}</span>
      <button onclick="window.app.removeUser(${u.id})" class="text-red-600 text-sm">🗑️</button>
    </div>
  `).join('') : '<p class="text-slate-500 text-sm">Kullanıcı yok</p>';
}

export async function addUser() {
  const email = document.getElementById('newUserEmail').value.trim();
  if (!email) { toast('Email gerekli'); return; }
  await fetch(`${API}/api/auth/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name: document.getElementById('newUserName').value.trim() })
  });
  import('./utils.js').then(u => u.closeModal('addUser'));
  loadUsers();
  toast('Eklendi ✓');
}

export async function removeUser(id) {
  if (!confirm('Silmek istediğinize emin misiniz?')) return;
  await fetch(`${API}/api/auth/users/${id}`, { method: 'DELETE' });
  loadUsers();
  toast('Silindi');
}
