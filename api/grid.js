export const config = { runtime: 'nodejs20.x' };

import { Client } from '@notionhq/client';

export default async function handler(req, res) {
  try {
    const { NOTION_TOKEN, NOTION_DATABASE_ID } = process.env;
    if (!NOTION_TOKEN || !NOTION_DATABASE_ID) {
      return res.status(500).json({ ok: false, message: 'Faltan variables NOTION_TOKEN / NOTION_DATABASE_ID' });
    }

    // Si te pasan ?token=... en la URL y quieres permitir un override, podrías validarlo aquí.
    // Para arrancar, usamos el modo global (solo variables de entorno).

    const notion = new Client({ auth: NOTION_TOKEN });
    const result = await notion.databases.query({
      database_id: NOTION_DATABASE_ID,
      page_size: 50,
      sorts: [{ timestamp: 'created_time', direction: 'descending' }]
    });

    // Mapea lo mínimo que necesitas para el grid
    const items = result.results.map(p => ({
      id: p.id,
      url: p.url,
      created: p.created_time
    }));

    res.status(200).json({ ok: true, count: items.length, items });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}
