// settings.js - Settings Management
import { API, state } from './config.js';
import { toast } from './utils.js';

// Default prompts
export const DEFAULT_BLOG_PROMPT = `YouTube transkriptini Türkçe SEO uyumlu blog yazısına dönüştür. 
Markdown formatında, 600-1000 kelime.
Format: BAŞLIK: [başlık]
---
[içerik]`;

export const DEFAULT_SEO_RULES = `## AI SEO Kuralları (Google + AI Arama Platformları)

### Genel İlkeler:
- Net, özlü ve doğrudan cevaplar ver
- Güvenilir kaynak gibi yaz, otorite oluştur
- Konuşma dilinde, anlaşılır bir üslup kullan
- Gereksiz dolgu kelimelerden kaçın

### Yapısal SEO:
- H2 ve H3 başlıkları ile içeriği bölümle
- Her bölüm tek bir konuya odaklansın
- Soru-cevap formatı kullan (SSS bölümü ekle)
- Maddeli listeler ve numaralı listeler kullan

### AI Arama Optimizasyonu (ChatGPT, Perplexity, AI Overview):
- İlk paragrafta ana soruyu doğrudan cevapla
- "Ne, Nasıl, Neden, Ne Zaman" sorularını yanıtla
- Tanımlar ve açıklamalar ekle
- Adım adım rehberler oluştur
- Özet kutusu veya anahtar çıkarımlar bölümü ekle

### İçerik Kalitesi:
- Özgün içgörüler ve deneyim paylaş
- Güncel ve doğru bilgi ver
- Spesifik örnekler ve senaryolar kullan
- Eyleme geçirilebilir tavsiyeler sun

### Anahtar Kelime Stratejisi:
- Doğal anahtar kelime yerleşimi
- Long-tail anahtar kelimeler kullan
- Semantik ilişkili kelimeler ekle
- Başlık ve ilk paragrafta ana anahtar kelime

### Kullanıcı Deneyimi:
- Kolay okunabilir paragraflar (3-4 cümle)
- Geçiş cümleleri ile akıcılık sağla
- Sonuç bölümünde özet ve çağrı-eylem ekle`;

export async function loadSettings() {
  // Local storage'dan yükle
  state.settings.youtubeApiKey = localStorage.getItem('youtubeApiKey') || '';
  state.settings.openaiApiKey = localStorage.getItem('openaiApiKey') || '';
  state.settings.assemblyaiApiKey = localStorage.getItem('assemblyaiApiKey') || '';
  state.settings.channelId = localStorage.getItem('channelId') || '';
  state.settings.transcriptionProvider = localStorage.getItem('transcriptionProvider') || 'openai';
  state.settings.blogPrompt = localStorage.getItem('blogPrompt') || DEFAULT_BLOG_PROMPT;
  state.settings.aiSeoRules = localStorage.getItem('aiSeoRules') || DEFAULT_SEO_RULES;
  
  // Input'lara yaz
  document.getElementById('youtubeApiKey').value = state.settings.youtubeApiKey;
  document.getElementById('openaiApiKey').value = state.settings.openaiApiKey;
  document.getElementById('assemblyaiApiKey').value = state.settings.assemblyaiApiKey;
  document.getElementById('youtubeChannelId').value = state.settings.channelId;
  document.getElementById('transcriptionProvider').value = state.settings.transcriptionProvider;
  document.getElementById('blogPrompt').value = state.settings.blogPrompt;
  document.getElementById('aiSeoRules').value = state.settings.aiSeoRules;
  
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
  state.settings.blogPrompt = document.getElementById('blogPrompt').value.trim() || DEFAULT_BLOG_PROMPT;
  state.settings.aiSeoRules = document.getElementById('aiSeoRules').value.trim() || DEFAULT_SEO_RULES;
  
  // Local storage'a kaydet
  localStorage.setItem('youtubeApiKey', state.settings.youtubeApiKey);
  localStorage.setItem('openaiApiKey', state.settings.openaiApiKey);
  localStorage.setItem('assemblyaiApiKey', state.settings.assemblyaiApiKey);
  localStorage.setItem('channelId', state.settings.channelId);
  localStorage.setItem('transcriptionProvider', state.settings.transcriptionProvider);
  localStorage.setItem('blogPrompt', state.settings.blogPrompt);
  localStorage.setItem('aiSeoRules', state.settings.aiSeoRules);
  
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

export function resetBlogPrompt() {
  document.getElementById('blogPrompt').value = DEFAULT_BLOG_PROMPT;
  state.settings.blogPrompt = DEFAULT_BLOG_PROMPT;
  localStorage.setItem('blogPrompt', DEFAULT_BLOG_PROMPT);
  toast('Blog promptu varsayılana döndürüldü');
}

export function resetSeoRules() {
  document.getElementById('aiSeoRules').value = DEFAULT_SEO_RULES;
  state.settings.aiSeoRules = DEFAULT_SEO_RULES;
  localStorage.setItem('aiSeoRules', DEFAULT_SEO_RULES);
  toast('SEO kuralları varsayılana döndürüldü');
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

// Get combined system prompt for blog generation
export function getBlogSystemPrompt() {
  const blogPrompt = state.settings.blogPrompt || DEFAULT_BLOG_PROMPT;
  const seoRules = state.settings.aiSeoRules || DEFAULT_SEO_RULES;
  
  return `${blogPrompt}

${seoRules}`;
}
