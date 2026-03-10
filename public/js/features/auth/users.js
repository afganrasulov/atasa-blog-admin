// features/auth/users.js - User Management
import { API } from '../../shared/config.js';
import { toast, closeModal } from '../../shared/utils.js';

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
    closeModal('addUser');
    loadUsers();
    toast('Eklendi ✓');
}

export async function removeUser(id) {
    if (!confirm('Silmek istediğinize emin misiniz?')) return;
    await fetch(`${API}/api/auth/users/${id}`, { method: 'DELETE' });
    loadUsers();
    toast('Silindi');
}
