// shared/config.js - Global configuration
export const API = ''; // Unified server — same origin
export const YT_API = 'https://www.googleapis.com/youtube/v3';

// Self-hosted GoTrue (Supabase Auth) on Hetzner VPS
const SUPABASE_URL = 'https://auth.atasa.mobi';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6ImF0YXNhLXNlbGYtaG9zdGVkIiwiaWF0IjoxNzgwNTIyMjk0LCJleHAiOjIwOTU4ODIyOTR9.LsZTNpx-1xsvGRa3PxIISkc5w3KGNBdYWXDXjcDV0uI';

const { createClient } = supabase;
export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global state
export const state = {
    posts: [],
    currentUser: null,
    cachedVideos: { video: [], short: [] },
    currentVideo: null,
    autopilot: false,
    statusCheckInterval: null,
    settings: {
        youtubeApiKey: '',
        openaiApiKey: '',
        assemblyaiApiKey: '',
        channelId: '',
        transcriptionProvider: 'openai',
        blogPrompt: '',
        aiSeoRules: '',
        aiTitleEnabled: false,
        autoScanEnabled: false,
        autoTranscribe: false,
        autoBlog: false,
        autoPublish: false,
        scanIntervalHours: '6',
        lastScanTime: ''
    }
};
