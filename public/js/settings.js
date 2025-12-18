// settings.js - Settings Management
import { API, state } from './config.js';
import { toast } from './utils.js';

// Default prompts
export const DEFAULT_BLOG_PROMPT = `YouTube video transkriptini Türkçe, SEO ve AI arama motorlarına (Google, ChatGPT, Perplexity, AI Overview) uyumlu blog yazısına dönüştür.

## Çıktı Formatı (AYNEN UYGULA):
BAŞLIK: [Başlık metni - düz metin, işaret kullanma]
---
META: [155 karakterlik meta açıklama - düz metin]
---
[HTML içerik buraya]

## Önemli Kurallar:
- BAŞLIK satırında sadece başlık metni olsun, ** veya başka işaret KULLANMA
- META satırında sadece açıklama metni olsun
- İçerikte Markdown KULLANMA, sadece HTML kullan
- İçeriğin başında BAŞLIK veya META tekrar etmesin

## HTML Yapısı:
- <h2> ve <h3> başlıklar (h1 kullanma)
- <p> paragraflar (3-4 cümle)
- <ul> veya <ol> listeler
- <strong> önemli terimler için

## İçerik Yapısı (800-1200 kelime):
1. Giriş: Ana soruyu ilk cümlede direkt cevapla (AI snippet için kritik)
2. Ana bölümler: H2 başlıklarla konuyu detaylandır
3. Pratik bilgiler: Liste veya adımlar halinde
4. SSS: 2-3 soru (<h3>Soru?</h3> <p>Cevap</p>)
5. Sonuç: Özet ve eylem çağrısı

## AI Arama Optimizasyonu:
- İlk paragrafta ana anahtar kelime ve net cevap olsun
- "Nedir", "Nasıl yapılır", "Ne kadar" sorularını cevapla
- Güncel tarihler ve spesifik rakamlar ver`;

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
  // Server'dan TÜM ayarları al (API key'ler dahil)
  try {
    const res = await fetch(`${API}/api/settings`);
    const data = await res.json();
    
    // Core settings
    state.autopilot = data.autopilot || false;
    
    // API Keys (sunucudan yükle)
    state.settings.youtubeApiKey = data.youtube_api_key || '';
    state.settings.openaiApiKey = data.openai_api_key || '';
    state.settings.assemblyaiApiKey = data.assemblyai_api_key || '';
    state.settings.channelId = data.channel_id || '';
    state.settings.transcriptionProvider = data.transcription_provider || 'openai';
    state.settings.blogPrompt = data.blog_prompt || DEFAULT_BLOG_PROMPT;
    state.settings.aiSeoRules = data.ai_seo_rules || DEFAULT_SEO_RULES;
    state.settings.aiTitleEnabled = data.ai_title_enabled || false;
    
    // Automation settings
    state.settings.autoScanEnabled = data.auto_scan_enabled || false;
    state.settings.autoTranscribe = data.auto_transcribe || false;
    state.settings.autoBlog = data.auto_blog || false;
    state.settings.autoPublish = data.auto_publish || false;
    state.settings.scanIntervalHours = data.scan_interval_hours || '6';
    state.settings.lastScanTime = data.last_scan_time || '';
    
    // Input'lara yaz (maskelenmiş göster)
    document.getElementById('youtubeApiKey').value = state.settings.youtubeApiKey;
    document.getElementById('openaiApiKey').value = state.settings.openaiApiKey;
    document.getElementById('assemblyaiApiKey').value = state.settings.assemblyaiApiKey;
    document.getElementById('youtubeChannelId').value = state.settings.channelId;
    document.getElementById('transcriptionProvider').value = state.settings.transcriptionProvider;
    document.getElementById('blogPrompt').value = state.settings.blogPrompt;
    document.getElementById('aiSeoRules').value = state.settings.aiSeoRules;
    
    // UI güncellemeleri
    updateProviderUI();
    updateAiTitleUI();
    updateAutopilotUI();
    updateAutomationUI();
    
    console.log('✅ Settings loaded from server');
  } catch (e) {
    console.error('Settings load error:', e);
    // Fallback: localStorage'dan yükle (eski veriler için)
    loadFromLocalStorage();
  }
}

function loadFromLocalStorage() {
  state.settings.youtubeApiKey = localStorage.getItem('youtubeApiKey') || '';
  state.settings.openaiApiKey = localStorage.getItem('openaiApiKey') || '';
  state.settings.assemblyaiApiKey = localStorage.getItem('assemblyaiApiKey') || '';
  state.settings.channelId = localStorage.getItem('channelId') || '';
  state.settings.transcriptionProvider = localStorage.getItem('transcriptionProvider') || 'openai';
  state.settings.blogPrompt = localStorage.getItem('blogPrompt') || DEFAULT_BLOG_PROMPT;
  state.settings.aiSeoRules = localStorage.getItem('aiSeoRules') || DEFAULT_SEO_RULES;
  state.settings.aiTitleEnabled = localStorage.getItem('aiTitleEnabled') === 'true';
  
  // Input'lara yaz
  document.getElementById('youtubeApiKey').value = state.settings.youtubeApiKey;
  document.getElementById('openaiApiKey').value = state.settings.openaiApiKey;
  document.getElementById('assemblyaiApiKey').value = state.settings.assemblyaiApiKey;
  document.getElementById('youtubeChannelId').value = state.settings.channelId;
  document.getElementById('transcriptionProvider').value = state.settings.transcriptionProvider;
  document.getElementById('blogPrompt').value = state.settings.blogPrompt;
  document.getElementById('aiSeoRules').value = state.settings.aiSeoRules;
  
  updateProviderUI();
  updateAiTitleUI();
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

export function updateAiTitleUI() {
  const toggle = document.getElementById('aiTitleToggle');
  const info = document.getElementById('aiTitleInfo');
  if (!toggle) return;
  
  toggle.className = `w-12 h-6 rounded-full relative cursor-pointer flex-shrink-0 ml-4 ${state.settings.aiTitleEnabled ? 'bg-green-500' : 'bg-slate-300'}`;
  toggle.querySelector('span').style.transform = state.settings.aiTitleEnabled ? 'translateX(24px)' : '';
  
  if (info) {
    if (state.settings.aiTitleEnabled) {
      info.classList.remove('hidden');
    } else {
      info.classList.add('hidden');
    }
  }
}

export async function toggleAiTitle() {
  state.settings.aiTitleEnabled = !state.settings.aiTitleEnabled;
  await saveSettingToServer('ai_title_enabled', state.settings.aiTitleEnabled);
  updateAiTitleUI();
  toast(state.settings.aiTitleEnabled ? 'AI başlık oluşturma açık' : 'AI başlık oluşturma kapalı');
}

// =====================
// AUTOMATION FUNCTIONS
// =====================

export function updateAutomationUI() {
  // Auto Scan Toggle
  const autoScanToggle = document.getElementById('autoScanToggle');
  const autoScanOptions = document.getElementById('autoScanOptions');
  if (autoScanToggle) {
    autoScanToggle.className = `w-12 h-6 rounded-full relative cursor-pointer flex-shrink-0 ml-4 transition-colors ${state.settings.autoScanEnabled ? 'bg-green-500' : 'bg-slate-300'}`;
    autoScanToggle.querySelector('span').style.transform = state.settings.autoScanEnabled ? 'translateX(24px)' : '';
    
    if (autoScanOptions) {
      autoScanOptions.classList.toggle('hidden', !state.settings.autoScanEnabled);
    }
  }
  
  // Scan Interval
  const scanInterval = document.getElementById('scanInterval');
  if (scanInterval && state.settings.scanIntervalHours) {
    scanInterval.value = state.settings.scanIntervalHours;
  }
  
  // Last Scan Time
  const lastScanTime = document.getElementById('lastScanTime');
  if (lastScanTime && state.settings.lastScanTime) {
    const date = new Date(state.settings.lastScanTime);
    lastScanTime.textContent = `Son tarama: ${date.toLocaleString('tr-TR')}`;
  }
  
  // Auto Transcribe Toggle
  const autoTranscribeToggle = document.getElementById('autoTranscribeToggle');
  if (autoTranscribeToggle) {
    autoTranscribeToggle.className = `w-12 h-6 rounded-full relative cursor-pointer flex-shrink-0 ml-4 transition-colors ${state.settings.autoTranscribe ? 'bg-green-500' : 'bg-slate-300'}`;
    autoTranscribeToggle.querySelector('span').style.transform = state.settings.autoTranscribe ? 'translateX(24px)' : '';
  }
  
  // Auto Blog Toggle
  const autoBlogToggle = document.getElementById('autoBlogToggle');
  if (autoBlogToggle) {
    autoBlogToggle.className = `w-12 h-6 rounded-full relative cursor-pointer flex-shrink-0 ml-4 transition-colors ${state.settings.autoBlog ? 'bg-green-500' : 'bg-slate-300'}`;
    autoBlogToggle.querySelector('span').style.transform = state.settings.autoBlog ? 'translateX(24px)' : '';
  }
  
  // Auto Publish Toggle
  const autoPublishToggle = document.getElementById('autoPublishToggle');
  if (autoPublishToggle) {
    autoPublishToggle.className = `w-12 h-6 rounded-full relative cursor-pointer flex-shrink-0 ml-4 transition-colors ${state.settings.autoPublish ? 'bg-green-500' : 'bg-slate-300'}`;
    autoPublishToggle.querySelector('span').style.transform = state.settings.autoPublish ? 'translateX(24px)' : '';
  }
}

export async function toggleAutoScan() {
  state.settings.autoScanEnabled = !state.settings.autoScanEnabled;
  await saveSettingToServer('auto_scan_enabled', state.settings.autoScanEnabled);
  updateAutomationUI();
  toast(state.settings.autoScanEnabled ? 'Otomatik tarama açık' : 'Otomatik tarama kapalı');
}

export async function toggleAutoTranscribe() {
  state.settings.autoTranscribe = !state.settings.autoTranscribe;
  await saveSettingToServer('auto_transcribe', state.settings.autoTranscribe);
  updateAutomationUI();
  toast(state.settings.autoTranscribe ? 'Otomatik deşifre açık' : 'Otomatik deşifre kapalı');
}

export async function toggleAutoBlog() {
  state.settings.autoBlog = !state.settings.autoBlog;
  await saveSettingToServer('auto_blog', state.settings.autoBlog);
  updateAutomationUI();
  toast(state.settings.autoBlog ? 'Otomatik blog oluşturma açık' : 'Otomatik blog oluşturma kapalı');
}

export async function toggleAutoPublish() {
  state.settings.autoPublish = !state.settings.autoPublish;
  await saveSettingToServer('auto_publish', state.settings.autoPublish);
  updateAutomationUI();
  toast(state.settings.autoPublish ? 'Otomatik yayınlama açık (blog yayınlanır)' : 'Otomatik yayınlama kapalı (taslak olarak kaydedilir)');
}

async function saveSettingToServer(key, value) {
  try {
    await fetch(`${API}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value })
    });
  } catch (e) {
    console.error('Setting save error:', e);
  }
}

export async function manualScan() {
  toast('Video taraması başlatılıyor...');
  try {
    const res = await fetch(`${API}/api/youtube/scan`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      toast('Tarama başlatıldı. Yeni videolar bulunursa işlenecek.');
    } else {
      toast('Tarama başlatılamadı: ' + (data.error || 'Bilinmeyen hata'));
    }
  } catch (e) {
    toast('Hata: ' + e.message);
  }
}

// =====================
// SAVE SETTINGS
// =====================

export async function saveSettings() {
  // Form'dan değerleri al
  state.settings.youtubeApiKey = document.getElementById('youtubeApiKey').value.trim();
  state.settings.openaiApiKey = document.getElementById('openaiApiKey').value.trim();
  state.settings.assemblyaiApiKey = document.getElementById('assemblyaiApiKey').value.trim();
  state.settings.channelId = document.getElementById('youtubeChannelId').value.trim();
  state.settings.transcriptionProvider = document.getElementById('transcriptionProvider').value;
  state.settings.blogPrompt = document.getElementById('blogPrompt').value.trim() || DEFAULT_BLOG_PROMPT;
  state.settings.aiSeoRules = document.getElementById('aiSeoRules').value.trim() || DEFAULT_SEO_RULES;
  
  // Get scan interval
  const scanInterval = document.getElementById('scanInterval');
  if (scanInterval) {
    state.settings.scanIntervalHours = scanInterval.value;
  }
  
  // Server'a TÜM ayarları kaydet (API key'ler dahil)
  try {
    await fetch(`${API}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        transcription_provider: state.settings.transcriptionProvider,
        youtube_api_key: state.settings.youtubeApiKey,
        openai_api_key: state.settings.openaiApiKey,
        assemblyai_api_key: state.settings.assemblyaiApiKey,
        channel_id: state.settings.channelId,
        blog_prompt: state.settings.blogPrompt,
        ai_seo_rules: state.settings.aiSeoRules,
        scan_interval_hours: state.settings.scanIntervalHours,
        ai_title_enabled: state.settings.aiTitleEnabled
      })
    });
    
    toast('Kaydedildi ✓');
  } catch (e) {
    console.error('Settings save error:', e);
    toast('Kaydetme hatası!');
  }
}

export function resetBlogPrompt() {
  document.getElementById('blogPrompt').value = DEFAULT_BLOG_PROMPT;
  state.settings.blogPrompt = DEFAULT_BLOG_PROMPT;
  toast('Blog promptu varsayılana döndürüldü');
}

export function resetSeoRules() {
  document.getElementById('aiSeoRules').value = DEFAULT_SEO_RULES;
  state.settings.aiSeoRules = DEFAULT_SEO_RULES;
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
  const aiTitleEnabled = state.settings.aiTitleEnabled;
  
  let prompt = blogPrompt;
  
  // Add AI title instruction if enabled
  if (aiTitleEnabled) {
    prompt += `

### Başlık Oluşturma:
- Video başlığını kullanma, SEO kurallarına göre yeni ve optimize edilmiş bir başlık oluştur
- Başlık Google ve AI arama platformlarında (ChatGPT, Perplexity, AI Overview) üst sıralarda çıkacak şekilde optimize edilmeli
- Başlık merak uyandırıcı, açık ve anahtar kelime içermeli
- 50-60 karakter arasında tut`;
  }
  
  return `${prompt}

${seoRules}`;
}
