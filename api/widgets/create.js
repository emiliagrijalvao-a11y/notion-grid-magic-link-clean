// /api/widgets/create.js
export const config = { runtime: 'nodejs' };

function extractDbId(url) {
  if (!url) return null;
  // Busca un ID de 32 hex (con o sin guiones)
  const m = String(url).match(/[a-f0-9]{32}|[a-f0-9-]{36}/i);
  if (!m) return null;
  return m[0].replace(/-/g, "").toLowerCase();
}

function randomId(n = 6) {
  const abc = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < n; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

async function getSupabase() {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase env (SUPABASE_URL / SUPABASE_SERVICE_ROLE).");
  return createClient(url, key);
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.status(405).json({ ok:false, error:'Method not allowed' });
      return;
    }

    const { notionToken, gridDbUrl, bioDbUrl } = req.body || {};
    if (!notionToken || !gridDbUrl) {
      res.status(400).json({ ok:false, error:'notionToken y gridDbUrl son obligatorios' });
      return;
    }

    const gridDbId = extractDbId(gridDbUrl);
    const bioDbId  = extractDbId(bioDbUrl || "");
    if (!gridDbId) {
      res.status(400).json({ ok:false, error:'No pude extraer el ID de la base Grid (revisa la URL)' });
      return;
    }

    const wid = randomId(6);

    // Guarda en Supabase
    const supabase = await getSupabase();
    const row = {
      wid,
      grid_db_id: gridDbId,
      bio_db_id: bioDbId,
      notion_token: notionToken,
      created_at: new Date().toISOString()
    };

    const { error } = await supabase.from('widgets').upsert(row, { onConflict: 'wid' });
    if (error) throw error;

    // Devuelve URL embebible
    res.status(200).json({
      ok: true,
      wid,
      widgetUrl: `/widget/?wid=${wid}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok:false, error: String(err.message || err) });
  }
}
