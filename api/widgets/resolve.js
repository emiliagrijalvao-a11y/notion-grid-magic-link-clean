// /api/widgets/resolve.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    res.status(500).json({ ok:false, error:'Missing Supabase env vars' });
    return;
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

  const { wid } = req.query || {};
  if (!wid) {
    res.status(400).json({ ok:false, error:'Falta el parámetro wid' });
    return;
  }

  const { data, error } = await supabase
    .from('widgets')
    .select('wid, grid_db_id, bio_db_id, plan')
    .eq('wid', wid)
    .maybeSingle();

  if (error) {
    res.status(500).json({ ok:false, error:String(error.message || error) });
    return;
  }
  if (!data) {
    res.status(404).json({ ok:false, error:'Widget no encontrado' });
    return;
  }

  res.status(200).json({ ok:true, ...data });
}
