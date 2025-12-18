// settings.js - Settings Management
import { API, state } from './config.js';
import { toast } from './utils.js';

export async function loadSettings() {
  // Local storage'dan yükle
  state.settings.youtubeApiKey = localStorage.getItem('youtubeApiKey') || '';
  state.settings.openaiApiKey = localStorage.getItem('openaiApiKey') || '';
  state.settings.assemblyaiApiKey = localStorage.getItem('assemblyaiApiKey') || '';
  state.settings.channelId = localStorage.getItem('channelId') || '';
  state.settings.transcriptionProvider = localStorage.getItem('transcriptionProvider') || 'openai';
  
  // Input'lara yaz
  document.getElementById('youtubeApiKey').value = state.settings.youtubeApiKey;
  document.getElementById('openaiApiKey').value = state.settings.openaiApiKey;
  document.getElementById('assemblyaiApiKey').value = state.settings.assemblyaiApiKey;
  document.getElementById('youtubeChannelId').value = state.settings.channelId;
  document.getElementById('transcriptionProvider').value = state.settings.transcriptionProvider;
  
  // Provider seçimine göre API key alanlarını göster/gizle
  updateProviderUI();
  
  // Server'dan ayarları al
  try {
    const res = await fetch(`${API}/api/settings`);
    const data = await res.json();
    state.autopilot = data.autopilot;
    if (data.transcription_provider) {
      state.settings.transcriptionProvider = data.transcription_provider;
      document.getElementById('transcriptionProvider').value = data.transcription_provider;
      localStorage.setItem('transcriptionProvider', data.transcription_provider);
      updateProviderUI();
    }
    updateAutopilotUI();
  } catch (e) {
    console.error('Settings load error:', e);
  }
}

export function updateProviderUI() {
  const provider = document.getElementById('transcriptionProvider').value;
  const openaiSection = document.getElementById('openaiKeySection');
  const assemblySection = document.getElementById('assemblyaiKeySection');
  
  if (provider === 'openai') {
    openaiSection.classList.remove('hidden');
    openaiSection.classList.add('ring-2', 'ring-green-500');
    assemblySection.classList.add('hidden');
    assemblySection.classList.remove('ring-2', 'ring-green-500');
  } else {
    assemblySection.classList.remove('hidden');
    assemblySection.classList.add('ring-2', 'ring-green-500');
    openaiSection.classList.add('hidden');
    openaiSection.classList.remove('ring-2', 'ring-green-500');
  }
}

export async function saveSettings() {
  state.settings.youtubeApiKey = document.getElementById('youtubeApiKey').value.trim();
  state.settings.openaiApiKey = document.getElementById('openaiApiKey').value.trim();
  state.settings.assemblyaiApiKey = document.getElementById('assemblyaiApiKey').value.trim();
  state.settings.channelId = document.getElementById('youtubeChannelId').value.trim();
  state.settings.transcriptionProvider = document.getElementById('transcriptionProvider').value;
  
  // Local storage'a kaydet
  localStorage.setItem('youtubeApiKey', state.settings.youtubeApiKey);
  localStorage.setItem('openaiApiKey', state.settings.openaiApiKey);
  localStorage.setItem('assemblyaiApiKey', state.settings.assemblyaiApiKey);
  localStorage.setItem('channelId', state.settings.channelId);
  localStorage.setItem('transcriptionProvider', state.settings.transcriptionProvider);
  
  // Server'a kaydet
  try {
    await fetch(`${API}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcription_provider: state.settings.transcriptionProvider })
    });
  } catch (e) {
    console.error('Settings save error:', e);
  }
  
  toast('Kaydedildi ✓');
}

export function updateAutopilotUI() {
  const t = document.getElementById('autopilotToggle');
  if (!t) return;
  t.className = `w-12 h-6 rounded-full relative cursor-pointer ${state.autopilot ? 'bg-green-500' : 'bg-slate-300'}`;
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

// Provider değiştiğinde çağrılır
export function onProviderChange() {
  updateProviderUI();
}
