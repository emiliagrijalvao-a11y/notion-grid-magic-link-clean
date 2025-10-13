// /api/widgets/create.js
// Crea un widget y devuelve la URL embebible.
// Requiere que la tabla `public.widgets` tenga (al menos) estas columnas:
// id (uuid, pk), notion_token (text), grid_db_url (text),
// bio_db_url (text, nullable), content_db_url (text, nullable),
// customer_id (text, nullable), email (text, nullable),
// type (text), plan (text), config (jsonb), created_at, updated_at.

import { supabase } from '../_supabase.js'; // ← ya existe en tu repo

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    // Node 20 ya trae fetch global: NO importes node-fetch.
    const body = await readJson(req, res);
    if (!body) return; // readJson ya respondió con 400 si falló

    // Nombres EXACTOS que envía el setup (v2)
    let {
      notion_token,
      grid_db_url,
      bio_db_url,
      content_db_url,
      customer_id,
      email,
    } = body;

    // Normaliza strings
    notion_token   = coerceStr(notion_token);
    grid_db_url    = coerceStr(grid_db_url);
    bio_db_url     = coerceStr(bio_db_url, true);
    content_db_url = coerceStr(content_db_url, true);
    customer_id    = coerceStr(customer_id, true);
    email          = coerceStr(email, true);

    // Validación mínima
    if (!notion_token || !grid_db_url) {
      return res.status(400).json({ success: false, error: 'Faltan campos' });
    }

    // Payload para la BD (valores por defecto coherentes con tu flujo)
    const payload = {
      notion_token,
      grid_db_url,
      bio_db_url:     bio_db_url || null,
      content_db_url: content_db_url || null,
      customer_id:    customer_id || null,
      email:          email || null,
      type: 'grid',
      plan: 'pro',
      config: {
        version: 1,
        sources: ['attachment', 'link', 'canva'],
      },
    };

    // Inserta y devuelve el id
    const { data, error } = await supabase
      .from('widgets')
      .insert([payload])
      .select('id')
      .single();

    if (error) {
      return res
        .status(500)
        .json({ success: false, error: `Supabase insert error: ${JSON.stringify(error)}` });
    }

    const base =
      (process.env.BASE_URL && process.env.BASE_URL.replace(/\/+$/, '')) ||
      new URL(req.url, `https://${req.headers.host}`).origin;

    // Tu widget público usa /widget/?id=XXXX
    const widgetUrl = `${base}/widget/?id=${data.id}`;

    return res.status(200).json({
      success: true,
      widgetId: data.id,
      widgetUrl,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, error: `Unhandled error: ${String(err)}` });
  }
}

// Helpers
function coerceStr(v, allowEmpty = false) {
  if (v == null) return '';
  const s = String(v).trim();
  return allowEmpty ? s : s || '';
}

async function readJson(req, res) {
  try {
    // Vercel Node.js API routes: req.body puede venir vacío si no hay bodyParser,
    // por eso leemos el stream manualmente si hace falta.
    if (req.body && typeof req.body === 'object') return req.body;
    const chunks = [];
    for await (const ch of req) chunks.push(ch);
    const raw = Buffer.concat(chunks).toString('utf8');
    if (!raw) {
      res.status(400).json({ success: false, error: 'Body vacío' });
      return null;
    }
    return JSON.parse(raw);
  } catch {
    res.status(400).json({ success: false, error: 'JSON inválido' });
    return null;
  }
}
