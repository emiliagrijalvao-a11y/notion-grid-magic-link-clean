// api/grid.js
export const config = { runtime: 'nodejs' }; // <— importante: "nodejs" (sin versión)

const NOTION_API = 'https://api.notion.com/v1/databases';
const NOTION_QUERY = 'https://api.notion.com/v1/databases/{db}/query';
const NOTION_PAGES = 'https://api.notion.com/v1/pages';

const NOTION_VERSION = '2022-06-28'; // estable

export default async function handler(req, res) {
  // CORS simple para pruebas
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const { NOTION_TOKEN, NOTION_DATABASE_ID } = process.env;
    if (!NOTION_TOKEN || !NOTION_DATABASE_ID) {
      return res.status(500).json({
        ok: false,
        message: 'Faltan variables de entorno',
        missing: ['NOTION_TOKEN', 'NOTION_DATABASE_ID'].filter(k => !process.env[k]),
      });
    }

    // 1) Traemos hasta 50 items (ajusta si hace falta)
    const url = NOTION_QUERY.replace('{db}', NOTION_DATABASE_ID);
    const q = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        page_size: 50,
        sorts: [{ timestamp: 'last_edited_time', direction: 'descending' }],
      }),
    });

    if (!q.ok) {
      const err = await safeJson(q);
      return res.status(q.status).json({ ok: false, message: 'Error Notion query', err });
    }

    const data = await q.json();

    // 2) Intentamos detectar nombres de propiedades comunes
    // Cambia aquí si tus columnas tienen otros nombres:
    const CANDIDATES = {
      title: ['Name', 'Title', 'Título', 'Nombre', 'Caption'],
      image: ['Image', 'Imagen', 'Cover', 'Portada', 'Photo'],
      link: ['Link', 'URL', 'Enlace', 'Href'],
      published: ['Published', 'Publicar', 'Publicado', 'Live'],
    };

    // utilidades
    const pickProp = (props, list) => {
      for (const name of list) if (props[name]) return name;
      return null;
    };

    // 3) Mapear cada página a un objeto light para el widget
    const items = data.results.map(page => {
      const props = page.properties || {};
      const titleKey = pickProp(props, CANDIDATES.title);
      const imageKey = pickProp(props, CANDIDATES.image);
      const linkKey  = pickProp(props, CANDIDATES.link);
      const pubKey   = pickProp(props, CANDIDATES.published);

      const title = titleKey
        ? (props[titleKey].title?.[0]?.plain_text
            || props[titleKey].rich_text?.[0]?.plain_text
            || '')
        : '';

      // Imagen puede estar en "files", "url" o "external"
      let imageUrl = '';
      if (imageKey) {
        const p = props[imageKey];
        if (p.type === 'files' && p.files?.length) {
          const f = p.files[0];
          imageUrl = f.file?.url || f.external?.url || '';
        } else if (p.type === 'url') {
          imageUrl = p.url || '';
        } else if (p.type === 'rich_text') {
          imageUrl = p.rich_text?.[0]?.plain_text || '';
        }
      }

      // Link
      let href = '';
      if (linkKey) {
        const p = props[linkKey];
        if (p.type === 'url') href = p.url || '';
        else if (p.type === 'rich_text') href = p.rich_text?.[0]?.plain_text || '';
      }

      // Published
      let published = true;
      if (pubKey) {
        const p = props[pubKey];
        if (p.type === 'checkbox') published = !!p.checkbox;
        else if (p.type === 'select') published = p.select?.name?.toLowerCase() === 'yes';
      }

      return {
        id: page.id,
        last_edited_time: page.last_edited_time,
        title,
        imageUrl,
        href,
        published,
      };
    })
    // opcional: solo los publicados y con imagen
    .filter(i => i.published !== false);

    return res.status(200).json({
      ok: true,
      count: items.length,
      items,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, message: 'SERVER_ERROR', error: String(e) });
  }
}

async function safeJson(resp) {
  try { return await resp.json(); } catch { return { statusText: resp.statusText }; }
}
