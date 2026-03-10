// config.js - Global configuration
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
  currentFilter: 'all',
  currentUser: null,
  currentVideo: null,
  autopilot: false,
  cachedVideos: { video: [], short: [] },
  settings: {
    // API Keys (sunucuda saklanır)
    youtubeApiKey: '',
    openaiApiKey: '',
    assemblyaiApiKey: '',
    channelId: '',
    
    // Transcription
    transcriptionProvider: 'openai', // 'openai' or 'assemblyai'
    
    // Blog Generation
    blogPrompt: '',
    aiSeoRules: '',
    aiTitleEnabled: false,
    
    // Automation
    autoScanEnabled: false,
    autoTranscribe: false,
    autoBlog: false,
    autoPublish: false,
    scanIntervalHours: '6',
    lastScanTime: ''
  },
  statusCheckInterval: null
};
