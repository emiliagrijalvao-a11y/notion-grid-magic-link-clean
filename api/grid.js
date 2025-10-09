// api/grid.js
export const config = { runtime: 'nodejs' };

import { getClientByToken, touchToken } from './_store.js';

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
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    let NOTION_TOKEN = process.env.NOTION_TOKEN;
    let NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID?.replace(/-/g, '');
    let usingClient = false;

    if (token) {
      const rec = getClientByToken(token);
      if (!rec || !rec.is_active) {
        return res.status(401).json({ ok: false, message: 'Token inválido o inactivo' });
      }
      touchToken(token);
      NOTION_TOKEN = rec.notion_token;
      NOTION_DATABASE_ID = rec.database_id?.replace(/-/g, '');
      usingClient = true;
    }

    const missing = [];
    if (!NOTION_TOKEN) missing.push('NOTION_TOKEN');
    if (!NOTION_DATABASE_ID) missing.push('NOTION_DATABASE_ID');
    if (missing.length) {
      return res.status(500).json({ ok: false, message: 'Faltan variables de entorno', missing, usingClient });
    }

    // Consulta Notion (query)
    const r = await fetch(`https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        page_size: 12,
        sorts: [{ timestamp: 'created_time', direction: 'descending' }]
      })
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({
        ok: false,
        message: 'Notion API error',
        status: r.status,
        details: String(text).slice(0, 500),
        usingClient
      });
    }

    const data = await r.json();
    const items = (data.results || []).map(p => ({
      id: p.id,
      created_time: p.created_time,
      last_edited_time: p.last_edited_time,
      url: p.url
    }));

    return res.status(200).json({ ok: true, usingClient, count: items.length, items });

  } catch (e) {
    return res.status(500).json({ ok: false, message: 'Server error', error: String(e?.message || e) });
  }
}
