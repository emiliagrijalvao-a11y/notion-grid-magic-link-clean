export const config = { runtime: 'nodejs' };

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE } = process.env;

export default async function handler(req, res) {
  try {
    const token = req.query.token || '';
    if (!token) return res.status(400).json({ ok: false, error: 'Missing token' });

    const url = new URL(`${SUPABASE_URL}/rest/v1/accounts`);
    url.searchParams.set('select', 'id,email,name,plan,licenses(*),widgets(*)');
    url.searchParams.set('setup_token', `eq.${token}`);

    const r = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        Prefer: 'count=exact'
      }
    });

    if (!r.ok) {
      const t = await r.text();
      return res.status(500).json({ ok: false, error: `Supabase ${r.status}: ${t}` });
    }

    const rows = await r.json();
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Account not found' });

    const acc = rows[0];

    // Normalizamos al formato que usa la UI
    const out = {
      email: acc.email,
      name: acc.name || '',
      accountType: acc.plan, // 'basic' | 'pro'
      licenses: (acc.licenses || []).map(l => ({
        type: l.type,
        key: l.key,
        date: l.issued_at
      })),
      widgets: (acc.widgets || []).map(w => ({
        id: w.id,
        token: '•••••••••••••••••••',
        databaseId: w.notion_database_id,
        url: `${process.env.BASE_URL}/preview?widget=${w.id}`
      }))
    };

    res.json(out);
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
}
