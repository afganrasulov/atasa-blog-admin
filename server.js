import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { pool, initDB } from './src/shared/database.js';

// Feature routes
import { authRoutes } from './src/features/auth/auth.routes.js';
import { settingsRoutes } from './src/features/settings/settings.routes.js';
import { tenantsRoutes } from './src/features/tenants/tenants.routes.js';
import { blogRoutes, sitemapRoutes } from './src/features/blog/blog.routes.js';
import { youtubeRoutes } from './src/features/youtube/youtube.routes.js';
import { transcriptionRoutes } from './src/features/transcription/transcription.routes.js';
import { carouselRoutes } from './src/features/carousel/carousel.routes.js';
import { setupCarouselRenderRoutes } from './src/features/carousel/carousel-render.js';
import { setupInstagramRoutes } from './src/features/instagram/instagram.routes.js';
import { getSetting } from './src/shared/helpers.js';
import { startScheduler } from './src/cron/scheduler.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/api', (req, res) => res.json({
  status: 'ok',
  message: 'Atasa Blog Admin — Unified Server',
  version: '3.0.0',
  features: ['blog', 'youtube', 'transcription', 'audio-extraction', 'carousel', 'instagram', 'multi-tenant']
}));

// Mount feature routes
app.use('/api/auth', authRoutes(pool));
app.use('/api/settings', settingsRoutes(pool));
app.use('/api/tenants', tenantsRoutes(pool));
app.use('/api/posts', blogRoutes(pool));
app.use('/api/webhook/blog', blogRoutes(pool)); // Webhook blog uses same router
app.use('/api/youtube', youtubeRoutes(pool, getSetting));

const transcriptionRouter = transcriptionRoutes(pool);
app.use('/api/youtube', transcriptionRouter);

app.use('/api/carousel', carouselRoutes(pool));
setupCarouselRenderRoutes(app, pool);
setupInstagramRoutes(app, pool);
sitemapRoutes(app, pool);

// Static files (frontend)
app.use(express.static('public'));

// SPA fallback — serve index.html for non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile('index.html', { root: 'public' });
  }
});

// Start server
app.listen(PORT, async () => {
  console.log(`� Atasa Blog Admin v3.0.0 on port ${PORT}`);
  console.log(`📦 Unified server: API + Audio Processor + Admin Panel`);
  await initDB();
  startScheduler(pool, transcriptionRouter);
});