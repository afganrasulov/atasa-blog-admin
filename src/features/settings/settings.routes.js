import { Router } from 'express';

export function settingsRoutes(pool) {
    const router = Router();

    router.get('/', async (req, res) => {
        try {
            const result = await pool.query('SELECT key, value FROM settings');
            const settings = {};
            result.rows.forEach(row => {
                if (row.value === 'true') settings[row.key] = true;
                else if (row.value === 'false') settings[row.key] = false;
                else settings[row.key] = row.value;
            });
            res.json(settings);
        } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
    });

    router.put('/', async (req, res) => {
        try {
            for (const [key, value] of Object.entries(req.body)) {
                await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [key, String(value)]);
            }
            res.json({ success: true });
        } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
    });

    return router;
}
