// features/auth/login.js - Authentication (Supabase Auth)
import { state, supabaseClient } from '../../shared/config.js';
import { toast } from '../../shared/utils.js';
import { loadPosts } from '../blog-posts/posts.js';
import { loadVideos, startStatusCheck } from '../youtube/videos.js';
import { loadSettings } from '../settings/settings.js';
import { loadUsers } from './users.js';

export async function initAuth() {
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
