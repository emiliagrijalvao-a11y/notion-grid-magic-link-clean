// api/widgets/create.js
import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'nodejs' }; // Node 20 OK

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE;
const baseUrl     = process.env.BASE_URL; // ej: https://notion-grid-magic-link-clean-git-main-flujo-creativo.vercel.app

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
});

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const { notion_token, grid_db_url, bio_db_url } = req.body || {};

    if (!notion_token || !grid_db_url) {
      return res.status(400).json({ ok: false, error: 'Faltan campos obligatorios' });
    }

    const config = { sources: ['attachment', 'link', 'canva'], version: 1 };

    const { data, error } = await supabase
      .from('widgets')
      .insert([{
        // client_id: null, // si tu tabla lo exige NOT NULL, agrega el client_id aquí.
        type: 'ig_grid',
        plan: 'pro',
        config,
        grid_db_url,
        bio_db_url: bio_db_url || null,
        notion_token,
        // email: req.headers['x-customer-email'] || null,
        // customer_id: req.headers['x-customer-id'] || null,
      }])
      .select('id')
      .single();

    if (error) {
      return res.status(500).json({ ok: false, error: `Supabase insert error: ${JSON.stringify(error)}` });
    }

    const widgetUrl = `${baseUrl.replace(/\/$/, '')}/widget?id=${data.id}`;
    return res.status(200).json({ ok: true, widget_url: widgetUrl });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}
