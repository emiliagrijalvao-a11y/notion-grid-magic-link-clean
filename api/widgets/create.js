const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

function makeId(len = 6) {
  const abc = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += abc[Math.floor(Math.random() * abc.length)];
  return out;
}

function extractDbId(url) {
  if (!url) return null;
  const match = url.match(/([a-f0-9]{32})/);
  return match ? match[1] : null;
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { email, notionToken, gridDbUrl, bioDbUrl, plan } = req.body || {};

    if (!gridDbUrl) {
      return res.status(400).json({ 
        success: false, 
        error: 'gridDbUrl es requerido' 
      });
    }

    // Extraer IDs de las URLs de Notion
    const gridDbId = extractDbId(gridDbUrl);
    const bioDbId = bioDbUrl ? extractDbId(bioDbUrl) : null;

    if (!gridDbId) {
      return res.status(400).json({
        success: false,
        error: 'No se pudo extraer el ID de la base de datos del Grid'
      });
    }

    // 1. Buscar o crear cliente
    let clientId;
    
    if (email) {
      const { data: existing } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (existing?.id) {
        clientId = existing.id;
      } else {
        const { data: newClient, error: errClient } = await supabaseAdmin
          .from('clients')
          .insert({ email, name: null })
          .select('id')
          .single();

        if (errClient) throw errClient;
        clientId = newClient.id;
      }
    } else {
      // Cliente anónimo temporal
      const tempEmail = `temp-${Date.now()}@ejemplo.com`;
      const { data: newClient, error: errClient } = await supabaseAdmin
        .from('clients')
        .insert({ email: tempEmail, name: null })
        .select('id')
        .single();

      if (errClient) throw errClient;
      clientId = newClient.id;
    }

    // 2. Crear widget
    const widgetId = makeId(6);
    
    const { data: widget, error: errWidget } = await supabaseAdmin
      .from('widgets')
      .insert({
        id: widgetId,
        client_id: clientId,
        type: 'ig_grid',
        plan: plan || 'pro',
        config: {},
        grid_db_url: gridDbId,
        bio_db_url: bioDbId,
        notion_token: notionToken || null
      })
      .select('id')
      .single();

    if (errWidget) throw errWidget;

    // 3. URLs públicas
    const BASE_URL = process.env.BASE_URL || 'https://notion-grid-magic-link-clean.vercel.app';
    const gridEmbedUrl = `${BASE_URL}/w/${widgetId}`;
    const bioEmbedUrl = bioDbId ? `${BASE_URL}/b/${widgetId}` : null;

    return res.status(200).json({
      success: true,
      ok: true,
      id: widgetId,
      widgetUrl: gridEmbedUrl,
      gridEmbedUrl,
      bioEmbedUrl,
      widgetId
    });

  } catch (err) {
    console.error('[widgets/create error]', err);
    return res.status(500).json({
      success: false,
      ok: false,
      error: err.message || String(err)
    });
  }
};
