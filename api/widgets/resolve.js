// /api/widgets/resolve.js
export const config = { runtime: 'nodejs' };

async function getSupabase() {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase env (SUPABASE_URL / SUPABASE_SERVICE_ROLE).");
  return createClient(url, key);
}

export default async function handler(req, res) {
  try {
    const wid = (req.query.wid || "").trim();
    if (!wid) {
      res.status(400).json({ ok:false, error:'Falta wid' });
      return;
    }
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('widgets')
      .select('grid_db_id,bio_db_id')
      .eq('wid', wid)
      .single();

    if (error || !data) {
      res.status(404).json({ ok:false, error:'Widget no encontrado' });
      return;
    }

    res.status(200).json({ ok:true, wid, gridDbId: data.grid_db_id, bioDbId: data.bio_db_id || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok:false, error:String(err.message || err) });
  }
}
