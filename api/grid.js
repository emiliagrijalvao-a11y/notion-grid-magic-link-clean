export const config = { runtime: 'nodejs' };

import { getClientByToken, touchToken } from './_store.js';

// Helpers para leer propiedades Notion de forma flexible
function getTitle(props) {
  // Busca property tipo 'title'
  const entry = Object.values(props).find(p => p?.type === 'title');
  if (!entry?.title?.length) return null;
  return entry.title.map(t => t.plain_text).join('').trim() || null;
}
function getRichText(props, keys = []) {
  // Busca por lista de nombres o por primera 'rich_text'
  for (const k of keys) {
    const p = props[k];
    if (p?.type === 'rich_text' && p.rich_text?.length) {
      return p.rich_text.map(t => t.plain_text).join('').trim() || null;
    }
  }
  const any = Object.values(props).find(p => p?.type === 'rich_text' && p.rich_text?.length);
  return any ? any.rich_text.map(t => t.plain_text).join('').trim() : null;
}
function getUrl(props, keys = []) {
  for (const k of keys) {
    const p = props[k];
    if (p?.type === 'url' && p.url) return p.url;
  }
  const any = Object.values(props).find(p => p?.type === 'url' && p.url);
  return any?.url || null;
}
function getImage(props, keys = []) {
  // Busca propiedades de tipo files con la primera imagen válida
  const prefer = [...keys, 'Image', 'Imagen', 'Imagenes', 'Images', 'Media', 'Attachments', 'Attachment', 'File', 'Files', 'Cover'];
  for (const k of prefer) {
    const p = props[k];
    if (p?.type === 'files' && Array.isArray(p.files) && p.files.length) {
      const f = p.files.find(f => f?.type === 'external' || f?.type === 'file') || p.files[0];
      if (f?.type === 'external' && f.external?.url) return f.external.url;
      if (f?.type === 'file' && f.file?.url) return f.file.url; // (puede expirar)
    }
  }
  // Fallback: a veces Notion expone cover en page.cover
  return null;
}

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
      const rec = getClientByToken?.(token);
      if (!rec || !rec.is_active) {
        return res.status(401).json({ ok: false, message: 'Token inválido o inactivo' });
      }
      touchToken?.(token);
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

    // 1) Query a Notion (puedes ajustar los sorts/filters según tu DB)
    const r = await fetch(`https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        page_size: 60,
        sorts: [{ timestamp: 'created_time', direction: 'descending' }]
      })
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({
        ok: false,
        message: 'Notion API error',
        status: r.status,
        details: String(text).slice(0, 800),
        usingClient
      });
    }

    const data = await r.json();

    // 2) Normaliza items
    const items = (data.results || []).map(page => {
      const props = page.properties || {};
      const title = getTitle(props) || page.url?.split('/').pop() || 'Untitled';
      const caption = getRichText(props, ['Caption', 'Descripción', 'Description', 'Text']);
      const href = getUrl(props, ['URL', 'Link', 'Enlace']) || page.url || null;
      let image = getImage(props, ['Image', 'Imagen', 'Media', 'Attachments', 'Attachment']);
      // Fallback: si no hay image en properties, intenta cover de page
      if (!image && page.cover) {
        if (page.cover.type === 'external') image = page.cover.external?.url || null;
        if (page.cover.type === 'file') image = page.cover.file?.url || null;
      }
      return {
        id: page.id,
        title,
        caption,
        href,
        image,
        created_time: page.created_time,
        last_edited_time: page.last_edited_time
      };
    }).filter(x => x.image); // muestra solo los que tienen imagen

    return res.status(200).json({ ok: true, usingClient, count: items.length, items });

  } catch (e) {
    return res.status(500).json({ ok: false, message: 'Server error', error: String(e?.message || e) });
  }
}
