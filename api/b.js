export default async function handler(req, res) {
  try {
    const id = req.query.id;
    if (!id) {
      res.status(400).send('Missing id');
      return;
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

    const r = await fetch(`${SUPABASE_URL}/rest/v1/widgets?id=eq.${encodeURIComponent(id)}&select=id,bio_db_url`, {
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

    const { bio_db_url } = rows[0];
    if (!bio_db_url) {
      res.status(404).send('No bio configured for this widget');
      return;
    }

    // Si ya tienes un destino para el bio, ponlo aquí:
    // Por ahora, redireccionamos al mismo mini con otro flag,
    // o cambia a tu propia página cuando la tengas lista.
    const BIO_PREVIEW_BASE = process.env.BIO_PREVIEW_BASE || 'https://notion-grid-mini.vercel.app/preview';
    const url = new URL(BIO_PREVIEW_BASE);
    url.searchParams.set('id', id);
    url.searchParams.set('db', bio_db_url);
    url.searchParams.set('bio', '1');

    res.setHeader('Location', url.toString());
    res.status(302).end();
  } catch (err) {
    res.status(500).send(String(err));
  }
}
