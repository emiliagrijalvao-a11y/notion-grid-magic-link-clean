export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    const { email, gridDbUrl, bioDbUrl, plan } = req.body || {};

    if (!email || !gridDbUrl) {
      res.status(400).json({ ok: false, error: 'email y gridDbUrl son requeridos' });
      return;
    }

    // id corto: 6-7 chars alfanum
    const id = makeId(6);
    const BASE_URL = process.env.BASE_URL;
    if (!BASE_URL) {
      res.status(500).json({ ok: false, error: 'Falta BASE_URL en variables de entorno' });
      return;
    }

    // Inserta en Supabase
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
      res.status(500).json({ ok: false, error: 'Faltan variables de Supabase' });
      return;
    }

    const insertBody = {
      id,
      email,
      plan: plan || 'basic',
      grid_db_url: gridDbUrl,
      bio_db_url: bioDbUrl || null
    };

    const up = await fetch(`${SUPABASE_URL}/rest/v1/widgets`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(insertBody)
    });

    if (!up.ok) {
      const err = await up.text();
      res.status(500).json({ ok: false, error: `Supabase insert error: ${err}` });
      return;
    }

    // URLs públicas y estables para el cliente:
    const gridEmbedUrl = `${BASE_URL}/w/${id}`;
    const bioEmbedUrl = bioDbUrl ? `${BASE_URL}/b/${id}` : null;

    res.json({ ok: true, id, gridEmbedUrl, bioEmbedUrl });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
}

function makeId(len = 6) {
  const abc = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += abc[Math.floor(Math.random() * abc.length)];
  return out;
}
