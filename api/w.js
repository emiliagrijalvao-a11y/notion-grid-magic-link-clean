export default async function handler(req, res) {
  try {
    const id = req.query.id;
    if (!id) {
      res.status(400).send('Missing id');
      return;
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
    const GRID_PREVIEW_BASE = process.env.GRID_PREVIEW_BASE || 'https://notion-grid-mini.vercel.app/preview';

    // Busca el registro
    const r = await fetch(`${SUPABASE_URL}/rest/v1/widgets?id=eq.${encodeURIComponent(id)}&select=id,grid_db_url`, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`
      }
    });

    if (!r.ok) {
      const err = await r.text();
      res.status(500).send(`Supabase select error: ${err}`);
      return;
    }

    const rows = await r.json();
    if (!rows || !rows.length) {
      res.status(404).send('Widget not found');
      return;
    }

    const { grid_db_url } = rows[0];
    if (!grid_db_url) {
      res.status(500).send('Missing grid_db_url');
      return;
    }

    // Redirección 302 al mini widget con params
    const url = new URL(GRID_PREVIEW_BASE);
    url.searchParams.set('id', id);
    url.searchParams.set('db', grid_db_url);

    res.setHeader('Location', url.toString());
    res.status(302).end();
  } catch (err) {
    res.status(500).send(String(err));
  }
}
