// features/settings/automation.js - Automation toggles
import { API, state } from '../../shared/config.js';
import { toast } from '../../shared/utils.js';

export function updateAutopilotUI() {
    const t = document.getElementById('autopilotToggle');
    if (!t) return;
    t.className = `w-12 h-6 rounded-full relative cursor-pointer ${state.autopilot ? 'bg-green-500' : 'bg-slate-300'}`;
    t.querySelector('span').style.transform = state.autopilot ? 'translateX(24px)' : '';
}

export async function toggleAutopilot() {
    state.autopilot = !state.autopilot;
    updateAutopilotUI();
    await fetch(`${API}/api/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ autopilot: state.autopilot }) });
    toast(state.autopilot ? 'Otopilot açık' : 'Otopilot kapalı');
}

export function updateAutomationUI() {
    const autoScanToggle = document.getElementById('autoScanToggle');
    const autoScanOptions = document.getElementById('autoScanOptions');
    if (autoScanToggle) {
        autoScanToggle.className = `w-12 h-6 rounded-full relative cursor-pointer flex-shrink-0 ml-4 transition-colors ${state.settings.autoScanEnabled ? 'bg-green-500' : 'bg-slate-300'}`;
        autoScanToggle.querySelector('span').style.transform = state.settings.autoScanEnabled ? 'translateX(24px)' : '';
        if (autoScanOptions) { autoScanOptions.classList.toggle('hidden', !state.settings.autoScanEnabled); }
    }
    const scanInterval = document.getElementById('scanInterval');
    if (scanInterval && state.settings.scanIntervalHours) { scanInterval.value = state.settings.scanIntervalHours; }
    const lastScanTime = document.getElementById('lastScanTime');
    if (lastScanTime && state.settings.lastScanTime) {
        const date = new Date(state.settings.lastScanTime);
        lastScanTime.textContent = `Son tarama: ${date.toLocaleString('tr-TR')}`;
    }
    const autoTranscribeToggle = document.getElementById('autoTranscribeToggle');
    if (autoTranscribeToggle) {
        autoTranscribeToggle.className = `w-12 h-6 rounded-full relative cursor-pointer flex-shrink-0 ml-4 transition-colors ${state.settings.autoTranscribe ? 'bg-green-500' : 'bg-slate-300'}`;
        autoTranscribeToggle.querySelector('span').style.transform = state.settings.autoTranscribe ? 'translateX(24px)' : '';
    }
    const autoBlogToggle = document.getElementById('autoBlogToggle');
    if (autoBlogToggle) {
        autoBlogToggle.className = `w-12 h-6 rounded-full relative cursor-pointer flex-shrink-0 ml-4 transition-colors ${state.settings.autoBlog ? 'bg-green-500' : 'bg-slate-300'}`;
        autoBlogToggle.querySelector('span').style.transform = state.settings.autoBlog ? 'translateX(24px)' : '';
    }
    const autoPublishToggle = document.getElementById('autoPublishToggle');
    if (autoPublishToggle) {
        autoPublishToggle.className = `w-12 h-6 rounded-full relative cursor-pointer flex-shrink-0 ml-4 transition-colors ${state.settings.autoPublish ? 'bg-green-500' : 'bg-slate-300'}`;
        autoPublishToggle.querySelector('span').style.transform = state.settings.autoPublish ? 'translateX(24px)' : '';
    }
}

async function saveSettingToServer(key, value) {
    try {
        await fetch(`${API}/api/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [key]: value }) });
    } catch (e) { console.error('Setting save error:', e); }
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

export async function manualScan() {
    toast('Video taraması başlatılıyor...');
    try {
        const res = await fetch(`${API}/api/youtube/scan`, { method: 'POST' });
        const data = await res.json();
        if (data.success) { toast('Tarama başlatıldı. Yeni videolar bulunursa işlenecek.'); }
        else { toast('Tarama başlatılamadı: ' + (data.error || 'Bilinmeyen hata')); }
    } catch (e) { toast('Hata: ' + e.message); }
}
