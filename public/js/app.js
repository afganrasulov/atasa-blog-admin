// app.js - Main Application Entry Point (FDD Structure)
import { initAuth, handleLogin, logout } from './features/auth/login.js';
import { addUser, removeUser } from './features/auth/users.js';
import { loadPosts, setFilter, publishPost, unpublishPost, deletePost, editPost, savePost } from './features/blog-posts/posts.js';
import { loadVideos, openVideoModal, reclassifyAllVideos } from './features/youtube/videos.js';
import { fetchAndSaveVideos, loadMoreVideos } from './features/youtube/fetch.js';
import { toggleVideoSelection, toggleSelectAll, clearSelection, setVideoFilter, bulkTranscribe, bulkGenerateBlog, retryFailedTranscriptions } from './features/youtube/selection.js';
import { transcribeAll, startBackgroundTranscription } from './features/transcription/transcribe.js';
import { generateBlog, saveBlog } from './features/transcription/blog-generator.js';
import { saveSettings, onProviderChange, resetBlogPrompt, resetSeoRules, toggleAiTitle } from './features/settings/settings.js';
import { toggleAutopilot, toggleAutoScan, toggleAutoTranscribe, toggleAutoBlog, toggleAutoPublish, manualScan } from './features/settings/automation.js';
import { switchPage, openModal, closeModal } from './shared/utils.js';

// Export all functions to window.app for HTML onclick handlers
window.app = {
  // Auth
  handleLogin,
  logout,
  addUser,
  removeUser,

  // Posts
  loadPosts,
  setFilter,
  publishPost,
  unpublishPost,
  deletePost,
  editPost,
  savePost,

  // YouTube
  loadVideos,
  fetchAndSaveVideos,
  openVideoModal,
  loadMoreVideos,
  toggleVideoSelection,
  toggleSelectAll,
  clearSelection,
  setVideoFilter,
  reclassifyAllVideos,

  // Transcription & Blog
  transcribeAll,
  startBackgroundTranscription,
  generateBlog,
  saveBlog,
  bulkTranscribe,
  bulkGenerateBlog,
  retryFailedTranscriptions,

  // Settings
  saveSettings,
  toggleAutopilot,
  onProviderChange,
  resetBlogPrompt,
  resetSeoRules,
  toggleAiTitle,
  toggleAutoScan,
  toggleAutoTranscribe,
  toggleAutoBlog,
  toggleAutoPublish,
  manualScan,

  // Navigation
  switchPage,
  openModal,
  closeModal
};

// Initialize
window.addEventListener('load', () => {
  initAuth();
});
