import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  options: '-c search_path=atasa_mobi,public'
});

export async function initDB() {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS settings (key VARCHAR(100) PRIMARY KEY, value TEXT)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS youtube_videos (id VARCHAR(50) PRIMARY KEY, title VARCHAR(500), description TEXT, thumbnail VARCHAR(500), duration INTEGER, view_count INTEGER, published_at TIMESTAMP, channel_id VARCHAR(50), video_type VARCHAR(20) DEFAULT 'video', audio_url TEXT, audio_status VARCHAR(20) DEFAULT 'pending', transcript TEXT, transcript_status VARCHAR(20) DEFAULT 'pending', transcript_job_id VARCHAR(100), transcript_model VARCHAR(50), transcript_updated_at TIMESTAMP, blog_created BOOLEAN DEFAULT FALSE, blog_post_id INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS allowed_users (id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL, name VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

    await pool.query(`CREATE TABLE IF NOT EXISTS carousel_posts (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER,
      title VARCHAR(500) NOT NULL,
      week_start DATE,
      week_end DATE,
      status VARCHAR(20) DEFAULT 'draft',
      cover_image_url TEXT,
      cover_image_prompt TEXT,
      slides JSONB DEFAULT '[]',
      raw_news JSONB DEFAULT '[]',
      caption TEXT,
      ig_media_id VARCHAR(50),
      scheduled_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      published_at TIMESTAMP
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS news_items (
      id SERIAL PRIMARY KEY,
      category VARCHAR(100) NOT NULL,
      title VARCHAR(500) NOT NULL,
      summary TEXT,
      source_url TEXT,
      source_name VARCHAR(100),
      emoji VARCHAR(10),
      news_date DATE,
      is_used BOOLEAN DEFAULT FALSE,
      carousel_id INTEGER REFERENCES carousel_posts(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS ig_tenants (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(100) UNIQUE NOT NULL,
      email VARCHAR(255) NOT NULL,
      brand_name VARCHAR(100),
      logo_url TEXT,
      primary_color VARCHAR(7) DEFAULT '#000000',
      ig_user_id VARCHAR(50),
      ig_username VARCHAR(50),
      ig_access_token TEXT,
      ig_token_expires_at TIMESTAMP,
      fb_page_id VARCHAR(50),
      fb_page_name VARCHAR(255),
      content_language VARCHAR(5) DEFAULT 'tr',
      default_hashtags TEXT,
      intro_template TEXT,
      plan VARCHAR(20) DEFAULT 'free',
      plan_expires_at TIMESTAMP,
      monthly_post_limit INTEGER DEFAULT 4,
      posts_this_month INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS ig_tenant_users (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES ig_tenants(id) ON DELETE CASCADE,
      email VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      role VARCHAR(20) DEFAULT 'editor',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenant_id, email)
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS ig_templates (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      cover_style JSONB DEFAULT '{}',
      intro_style JSONB DEFAULT '{}',
      category_style JSONB DEFAULT '{}',
      background_color VARCHAR(7) DEFAULT '#FFFFFF',
      text_color VARCHAR(7) DEFAULT '#000000',
      accent_color VARCHAR(7) DEFAULT '#0066FF',
      font_family VARCHAR(100) DEFAULT 'Inter',
      is_public BOOLEAN DEFAULT FALSE,
      created_by INTEGER REFERENCES ig_tenants(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS ig_scheduled_posts (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER REFERENCES ig_tenants(id) ON DELETE CASCADE,
      carousel_id INTEGER REFERENCES carousel_posts(id) ON DELETE CASCADE,
      scheduled_at TIMESTAMP NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      ig_media_id VARCHAR(50),
      error_message TEXT,
      published_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Add columns if not exist
    await pool.query(`ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS audio_url TEXT`);
    await pool.query(`ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS audio_status VARCHAR(20) DEFAULT 'pending'`);
    await pool.query(`ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS transcript_job_id VARCHAR(100)`);
    await pool.query(`ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS blog_created BOOLEAN DEFAULT FALSE`);
    await pool.query(`ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS blog_post_id INTEGER`);
    await pool.query(`ALTER TABLE carousel_posts ADD COLUMN IF NOT EXISTS tenant_id INTEGER`);
    await pool.query(`ALTER TABLE carousel_posts ADD COLUMN IF NOT EXISTS ig_media_id VARCHAR(50)`);
    await pool.query(`ALTER TABLE carousel_posts ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP`);
    await pool.query(`ALTER TABLE carousel_posts ADD COLUMN IF NOT EXISTS caption TEXT`);

    // YouTube audio download job queue (GitHub Actions worker callback)
    await pool.query(`CREATE TABLE IF NOT EXISTS yt_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      video_id VARCHAR(50) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      audio_url TEXT,
      key TEXT,
      size_bytes BIGINT,
      error_message TEXT,
      gh_run_id BIGINT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_yt_jobs_video ON yt_jobs(video_id, status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_yt_jobs_status ON yt_jobs(status, created_at DESC)`);

    // Default settings
    const defaults = [
      ['autopilot', 'false'], ['transcription_provider', 'openai'],
      ['auto_scan_enabled', 'false'], ['auto_transcribe', 'false'],
      ['auto_blog', 'false'], ['auto_publish', 'false'],
      ['scan_interval_hours', '6'], ['last_scan_time', '']
    ];
    for (const [key, value] of defaults) {
      await pool.query(`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, [key, value]);
    }

    await pool.query(`INSERT INTO allowed_users (email, name) VALUES ('afganrasulov@gmail.com', 'Afgan Rasulov') ON CONFLICT (email) DO NOTHING`);
    await pool.query(`INSERT INTO ig_templates (name, description, is_public) VALUES ('Classic White', 'Temiz, minimalist beyaz tasarım', TRUE) ON CONFLICT DO NOTHING`);
    await pool.query(`INSERT INTO ig_tenants (name, slug, email, brand_name, default_hashtags, plan, monthly_post_limit) VALUES ('Atasa Danışmanlık', 'atasa', 'info@atasadanismanlik.com', 'ATASA', '#göçmenlik #türkiye #oturmaiizni #çalışmaizni #vize #vatandaşlık', 'pro', 20) ON CONFLICT (slug) DO NOTHING`);

    console.log('✅ Database initialized');
  } catch (error) { console.error('Database init error:', error); }
}
