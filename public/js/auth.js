// auth.js - Authentication & User Management (Supabase Auth)
import { API, state, supabaseClient } from './config.js';
import { toast } from './utils.js';
import { loadPosts } from './posts.js';
import { loadVideos, startStatusCheck } from './videos.js';
import { loadSettings } from './settings.js';

export async function initAuth() {
  // Check existing session
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    state.currentUser = {
      email: session.user.email,
      name: session.user.user_metadata?.full_name || session.user.email
    };
    showApp();
  } else {
    showLogin();
  }

  // Listen for auth state changes
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      state.currentUser = null;
      showLogin();
    }
  });
}

export function showLogin() {
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('mainApp').classList.add('hidden');
  // Clear form
  const emailInput = document.getElementById('loginEmail');
  const passInput = document.getElementById('loginPassword');
  if (emailInput) emailInput.value = '';
  if (passInput) passInput.value = '';
}

export function showApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
  document.getElementById('userEmail').textContent = state.currentUser?.email || '';
  loadSettings();
  loadPosts();
  loadVideos();
  loadUsers();
  startStatusCheck();
}

export async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');
  const loginBtn = document.getElementById('loginBtn');

  if (!email || !password) {
    errorEl.textContent = 'Email ve şifre gerekli.';
    errorEl.classList.remove('hidden');
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = 'Giriş yapılıyor...';
  errorEl.classList.add('hidden');

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    errorEl.textContent = 'Email veya şifre hatalı.';
    errorEl.classList.remove('hidden');
    loginBtn.disabled = false;
    loginBtn.textContent = 'Giriş Yap';
    return;
  }

  state.currentUser = {
    email: data.user.email,
    name: data.user.user_metadata?.full_name || data.user.email
  };

  loginBtn.disabled = false;
  loginBtn.textContent = 'Giriş Yap';
  showApp();
  toast(`Hoş geldin! 👋`);
}

export async function logout() {
  await supabaseClient.auth.signOut();
  state.currentUser = null;
  if (state.statusCheckInterval) clearInterval(state.statusCheckInterval);
  showLogin();
}

// User Management (still uses Railway API)
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
