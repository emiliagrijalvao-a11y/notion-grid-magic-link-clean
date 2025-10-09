export const config = { runtime: 'nodejs' }; // NO 'nodejs20.x'

export default async function handler(req, res) {
  // CORS/preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const { NOTION_TOKEN, NOTION_DATABASE_ID } = process.env;

    // Validación de env vars
    const missing = [];
    if (!NOTION_TOKEN) missing.push('NOTION_TOKEN');
    if (!NOTION_DATABASE_ID) missing.push('NOTION_DATABASE_ID');
    if (missing.length) {
      return res.status(500).json({
        ok: false,
        message: 'Faltan variables de entorno',
        missing,
      });
    }

    // Llamada directa a Notion Database Query
    const r = await fetch(`https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({ page_size: 12 }) // ajusta si quieres
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({
        ok: false,
        message: 'Notion API error',
        status: r.status,
        details: safeSlice(text)
      });
    }

    const data = await r.json();

    // Respuesta minimal para probar (luego formateamos como widget)
    return res.status(200).json({
      ok: true,
      count: data.results?.length || 0,
      items: (data.results || []).map(x => ({
        id: x.id,
        last_edited_time: x.last_edited_time
      }))
    });

  } catch (e) {
    return res.status(500).json({
      ok: false,
      message: 'Server error',
      error: String(e?.message || e)
    });
  }
}

// Evita enviar logs enormes
function safeSlice(s, n = 500) {
  try { return String(s).slice(0, n); } catch { return ''; }
}
