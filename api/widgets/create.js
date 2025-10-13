// api/widgets/create.js
import { createClient } from '@supabase/supabase-js';

export const config = { runtime: 'nodejs' };

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE;
const baseUrl     = process.env.BASE_URL;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
});

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    // ✅ CAPTURAR email y plan del body (vienen del frontend)
    const { notion_token, grid_db_url, bio_db_url, email, plan } = req.body || {};

    if (!notion_token || !grid_db_url) {
      return res.status(400).json({ ok: false, error: 'Faltan campos obligatorios' });
    }

    const config = { sources: ['attachment', 'link', 'canva'], version: 1 };

    // ✅ INSERTAR con email y plan del cliente
    const { data, error } = await supabase
      .from('widgets')
      .insert([{
        type: 'ig_grid',
        plan: plan || 'pro',  // ✅ Usar el plan que viene del frontend
        config,
        grid_db_url,
        bio_db_url: bio_db_url || null,
        notion_token,
        email: email || null,  // ✅ Guardar el email del cliente
      }])
      .select('id')
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ 
        ok: false, 
        error: `Supabase insert error: ${error.message || JSON.stringify(error)}` 
      });
    }

    // ✅ IMPORTANTE: La URL debe apuntar a /setup?id=XXX (no /widget?id=XXX)
    // Porque el cliente ya está EN /setup y solo necesita el widget embebible
    const widgetUrl = `${baseUrl.replace(/\/$/, '')}/widget?id=${data.id}`;

    return res.status(200).json({ 
      ok: true, 
      widget_url: widgetUrl,
      widget_id: data.id
    });

  } catch (e) {
    console.error('Error in create widget:', e);
    return res.status(500).json({ 
      ok: false, 
      error: e?.message || String(e) 
    });
  }
}
