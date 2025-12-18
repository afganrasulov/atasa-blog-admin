// settings.js - Settings Management
import { API, state } from './config.js';
import { toast } from './utils.js';

export function loadSettings() {
  state.settings.youtubeApiKey = localStorage.getItem('youtubeApiKey') || '';
  state.settings.openaiApiKey = localStorage.getItem('openaiApiKey') || '';
  state.settings.assemblyaiApiKey = localStorage.getItem('assemblyaiApiKey') || '880456141ffa4ac5b860408278aef7f9';
  state.settings.channelId = localStorage.getItem('channelId') || '';
  document.getElementById('youtubeApiKey').value = state.settings.youtubeApiKey;
  document.getElementById('openaiApiKey').value = state.settings.openaiApiKey;
  document.getElementById('assemblyaiApiKey').value = state.settings.assemblyaiApiKey;
  document.getElementById('youtubeChannelId').value = state.settings.channelId;
  fetch(`${API}/api/settings`).then(r => r.json()).then(d => {
    state.autopilot = d.autopilot;
    updateAutopilotUI();
  });
}

export function saveSettings() {
  state.settings.youtubeApiKey = document.getElementById('youtubeApiKey').value.trim();
  state.settings.openaiApiKey = document.getElementById('openaiApiKey').value.trim();
  state.settings.assemblyaiApiKey = document.getElementById('assemblyaiApiKey').value.trim();
  state.settings.channelId = document.getElementById('youtubeChannelId').value.trim();
  localStorage.setItem('youtubeApiKey', state.settings.youtubeApiKey);
  localStorage.setItem('openaiApiKey', state.settings.openaiApiKey);
  localStorage.setItem('assemblyaiApiKey', state.settings.assemblyaiApiKey);
  localStorage.setItem('channelId', state.settings.channelId);
  toast('Kaydedildi ✓');
}

export function updateAutopilotUI() {
  const t = document.getElementById('autopilotToggle');
  t.className = `w-12 h-6 rounded-full relative ${state.autopilot ? 'bg-green-500' : 'bg-slate-300'}`;
  t.querySelector('span').style.transform = state.autopilot ? 'translateX(24px)' : '';
}

export async function toggleAutopilot() {
  state.autopilot = !state.autopilot;
  updateAutopilotUI();
  await fetch(`${API}/api/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ autopilot: state.autopilot })
  });
  toast(state.autopilot ? 'Otopilot açık' : 'Otopilot kapalı');
}
