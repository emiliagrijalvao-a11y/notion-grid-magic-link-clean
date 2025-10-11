export const config = { runtime: 'nodejs' };

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE, BASE_URL } = process.env;

// extrae un ID de base de Notion (32 chars) desde la URL pegada
function extractNotionDbId(dbUrl) {
  if (!dbUrl) return '';
  const m = dbUrl.match(/[0-9a-f]{32}/i);
  return m ? m[0] : '';
}

function randomId(n = 6) {
  return Math.random().toString(36).slice(2, 2 + n);
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

    const { token, notionToken, databaseUrl } = req.body || {};
    if (!token || !notionToken || !databaseUrl) {
      return res.status(400).json({ ok: false, error: 'Missing token/notionToken/databaseUrl' });
    }

    // 1) Busca el account por setup_token
    const accUrl = new URL(`${SUPABASE_URL}/rest/v1/accounts`);
    accUrl.searchParams.set('select', 'id,plan');
    accUrl.searchParams.set('setup_token', `eq.${token}`);

    const accRes = await fetch(accUrl, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`
      }
    });
    if (!accRes.ok) return res.status(500).json({ ok: false, error: `Supabase ${accRes.status}` });
    const accRows = await accRes.json();
    if (!accRows.length) return res.status(404).json({ ok: false, error: 'Account not found' });

    const accountId = accRows[0].id;

    // 2) Genera widget
    const widgetId = randomId(6);
    const notionDbId = extractNotionDbId(databaseUrl);
    if (!notionDbId) return res.status(400).json({ ok: false, error: 'Invalid Notion Database URL' });

    // 3) Inserta en widgets
    const wRes = await fetch(`${SUPABASE_URL}/rest/v1/widgets`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({
        id: widgetId,
        account_id: accountId,
        notion_database_id: notionDbId,
        notion_integration_token: notionToken
      })
    });

    if (!wRes.ok) {
      const t = await wRes.text();
      return res.status(500).json({ ok: false, error: `Insert widget ${wRes.status}: ${t}` });
    }

    const widgetUrl = `${BASE_URL}/preview?widget=${widgetId}`;
    res.json({ ok: true, widgetId, widgetUrl });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
}
