import { Router } from 'express';

export function tenantsRoutes(pool) {
    const router = Router();

    router.get('/', async (req, res) => {
        try {
            const result = await pool.query('SELECT id, name, slug, email, brand_name, ig_username, plan, is_active, created_at FROM ig_tenants ORDER BY created_at DESC');
            res.json(result.rows);
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    router.get('/:slug', async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM ig_tenants WHERE slug = $1', [req.params.slug]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Tenant not found' });
            const tenant = result.rows[0];
            delete tenant.ig_access_token;
            res.json(tenant);
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    router.post('/', async (req, res) => {
        try {
            const { name, slug, email, brand_name, default_hashtags, plan } = req.body;
            if (!name || !slug || !email) return res.status(400).json({ error: 'name, slug, email required' });
            const result = await pool.query(
                `INSERT INTO ig_tenants (name, slug, email, brand_name, default_hashtags, plan) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [name, slug.toLowerCase(), email, brand_name || name.split(' ')[0].toUpperCase(), default_hashtags || '', plan || 'free']
            );
            res.status(201).json({ success: true, tenant: result.rows[0] });
        } catch (error) {
            if (error.code === '23505') return res.status(400).json({ error: 'Slug already exists' });
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/:id', async (req, res) => {
        try {
            const { name, email, brand_name, logo_url, primary_color, default_hashtags, plan, monthly_post_limit, is_active } = req.body;
            const result = await pool.query(
                `UPDATE ig_tenants SET 
          name = COALESCE($1, name), email = COALESCE($2, email), brand_name = COALESCE($3, brand_name),
          logo_url = COALESCE($4, logo_url), primary_color = COALESCE($5, primary_color),
          default_hashtags = COALESCE($6, default_hashtags), plan = COALESCE($7, plan),
          monthly_post_limit = COALESCE($8, monthly_post_limit), is_active = COALESCE($9, is_active),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $10 RETURNING *`,
                [name, email, brand_name, logo_url, primary_color, default_hashtags, plan, monthly_post_limit, is_active, req.params.id]
            );
            if (result.rows.length === 0) return res.status(404).json({ error: 'Tenant not found' });
            res.json({ success: true, tenant: result.rows[0] });
        } catch (error) { res.status(500).json({ error: error.message }); }
    });

    router.delete('/:id', async (req, res) => {
        try { await pool.query('DELETE FROM ig_tenants WHERE id = $1', [req.params.id]); res.json({ success: true }); }
        catch (error) { res.status(500).json({ error: error.message }); }
    });

    return router;
}
