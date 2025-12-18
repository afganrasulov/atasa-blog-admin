// app.js - Main Application Entry Point
import { initAuth, logout, addUser, removeUser } from './auth.js';
import { loadPosts, setFilter, publishPost, unpublishPost, deletePost, editPost, savePost } from './posts.js';
import { loadVideos, fetchAndSaveVideos, openVideoModal, loadMoreVideos } from './videos.js';
import { transcribeAll, startBackgroundTranscription, generateBlog, saveBlog } from './transcription.js';
import { saveSettings, toggleAutopilot, onProviderChange } from './settings.js';
import { switchPage, openModal, closeModal } from './utils.js';

// Export all functions to window.app for HTML onclick handlers
window.app = {
  // Auth
  logout,
  addUser,
  removeUser,
  
  // Posts
  setFilter,
  publishPost,
  unpublishPost,
  deletePost,
  editPost,
  savePost,
  
  // Videos
  fetchAndSaveVideos,
  openVideoModal,
  loadMoreVideos,
  
  // Transcription
  transcribeAll,
  startBackgroundTranscription,
  generateBlog,
  saveBlog,
  
  // Settings
  saveSettings,
  toggleAutopilot,
  onProviderChange,
  
  // Utils
  switchPage,
  openModal,
  closeModal,
  openAddUserModal: () => openModal('addUser')
};

// Initialize app when DOM is ready
window.onload = () => {
  initAuth();
};
