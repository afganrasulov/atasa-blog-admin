// config.js - Global configuration
export const API = 'https://atasa-blog-api-production-22a4.up.railway.app';
export const YT_API = 'https://www.googleapis.com/youtube/v3';
export const GOOGLE_CLIENT_ID = '490053519646-ri90e1mmbkgb7dj9vqt0982m735ch3de.apps.googleusercontent.com';

// Global state
export const state = {
  posts: [],
  currentFilter: 'all',
  currentUser: null,
  currentVideo: null,
  autopilot: false,
  cachedVideos: { video: [], short: [] },
  settings: {
    youtubeApiKey: '',
    openaiApiKey: '',
    assemblyaiApiKey: '',
    channelId: '',
    transcriptionProvider: 'openai' // 'openai' or 'assemblyai'
  },
  statusCheckInterval: null
};
