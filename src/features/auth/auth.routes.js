import { Router } from 'express';

export function authRoutes(pool) {
    const router = Router();

    router.post('/verify', async (req, res) => {
        try {
            const { email } = req.body;
            if (!email) return res.status(400).json({ error: 'Email required' });
            const result = await pool.query('SELECT * FROM allowed_users WHERE email = $1', [email.toLowerCase()]);
            res.json(result.rows.length > 0 ? { allowed: true, user: result.rows[0] } : { allowed: false });
        } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
    });

    router.get('/users', async (req, res) => {
        try { res.json((await pool.query('SELECT * FROM allowed_users ORDER BY created_at')).rows); }
        catch (error) { res.status(500).json({ error: 'Internal server error' }); }
    });

    router.post('/users', async (req, res) => {
        try {
            const { email, name } = req.body;
            if (!email) return res.status(400).json({ error: 'Email required' });
            const result = await pool.query('INSERT INTO allowed_users (email, name) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET name = $2 RETURNING *', [email.toLowerCase(), name || '']);
            res.json({ success: true, user: result.rows[0] });
        } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
    });

    router.delete('/users/:id', async (req, res) => {
        try { await pool.query('DELETE FROM allowed_users WHERE id = $1', [req.params.id]); res.json({ success: true }); }
        catch (error) { res.status(500).json({ error: 'Internal server error' }); }
    });

    return router;
}
