// /api/widgets/create.js
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

function extractDbId(url) {
  if (!url) return null;
  const clean = String(url).replace(/-/g, '');
  const m = clean.match(/[0-9a-fA-F]{32}/);
  return m ? m[0] : null;
}
function genId(n = 6) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(n);
  let out = '';
  for (let i = 0; i < n; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}
function getOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  return `${proto}://${host}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success:false, error:'Method not allowed' });
    return;
  }
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    res.status(500).json({ success:false, error:'Missing Supabase env vars' });
    return;
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

  try {
    const { email, notionToken, gridDbUrl, bioDbUrl } = req.body || {};
    if (!notionToken || !gridDbUrl || !bioDbUrl) {
      res.status(400).json({ success:false, error:'Faltan campos: notionToken, gridDbUrl, bioDbUrl' });
      return;
    }

    const grid_db_id = extractDbId(gridDbUrl);
    const bio_db_id  = extractDbId(bioDbUrl);
    if (!grid_db_id || !bio_db_id) {
      res.status(400).json({ success:false, error:'URLs de Notion inválidas (no se detectó el ID de la base).' });
      return;
    }

    // Genera un WID único
    let wid = genId(6);
    // (opcional) asegurar unicidad con reintentos simples
    for (let i=0;i<3;i++){
      const { data:exists } = await supabase.from('widgets').select('wid').eq('wid', wid).maybeSingle();
      if (!exists) break;
      wid = genId(6);
    }

    const { error:insErr } = await supabase.from('widgets').insert({
      wid,
      owner_email: email || null,
      notion_token: notionToken,
      grid_db_id,
      bio_db_id,
      plan: 'basic'
    });
    if (insErr) throw insErr;

    const origin = getOrigin(req);
    const widgetUrl = `${origin}/widget/?wid=${encodeURIComponent(wid)}`;

    res.status(200).json({ success:true, wid, widgetUrl });
  } catch (err) {
    res.status(500).json({ success:false, error:String(err.message || err) });
  }
}
