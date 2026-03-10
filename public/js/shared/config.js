// shared/config.js - Global configuration
export const API = 'https://atasa-blog-api-production-22a4.up.railway.app';
export const YT_API = 'https://www.googleapis.com/youtube/v3';

// Supabase Auth
const SUPABASE_URL = 'https://khlvkvusavalbkjrwbsy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtobHZrdnVzYXZhbGJranJ3YnN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MjYxODQsImV4cCI6MjA4NDQwMjE4NH0.n-e2Dy_YTyWuzvUsKNyie10H_i_X50Kv-KMAtX2c2CY';

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
