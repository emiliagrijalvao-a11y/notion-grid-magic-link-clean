export const config = { runtime: 'nodejs' };

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE,
  RESEND_API_KEY,
  FROM_EMAIL,
  BASE_URL,
} = process.env;

async function createWidgetInSupabase(payload) {
  const url = `${SUPABASE_URL}/rest/v1/rpc/api_create_widget`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      p_email: payload.email || null,
      p_plan: payload.plan || 'pro',
      p_notion_token: payload.notionToken,
      p_grid_db_url: payload.gridDbUrl,
      p_bio_db_url: payload.bioDbUrl || null,
    }),
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => null);
    throw new Error(`Supabase RPC error: ${txt || r.status}`);
  }

  const data = await r.json();
  const first = Array.isArray(data) ? data[0] : data;
  if (!first || !first.widget_id) {
    throw new Error('Respuesta RPC sin widget_id');
  }
  return first.widget_id;
}

async function sendEmail(to, widgetUrl) {
  if (!to || !RESEND_API_KEY || !FROM_EMAIL) return;

  const html = `
  <div style="font-family:Inter,Arial,sans-serif;color:#000;background:#D9D9D9;padding:28px">
    <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #ddd;padding:24px">
      <h2 style="margin:0 0 12px 0;font-family:Oswald,Arial,sans-serif;letter-spacing:.5px">Tu widget está listo</h2>
      <p style="margin:0 0 16px 0;line-height:1.6">
        Copia y pega este enlace en tu Notion con <strong>/embed</strong>:
      </p>
      <p style="margin:12px 0 20px 0">
        <a href="${widgetUrl}" style="display:inline-block;background:#000;color:#fff;padding:12px 18px;text-decoration:none">Ir al Setup del widget</a>
      </p>
      <div style="font-family:ui-monospace,monospace;font-size:13px;background:#f7f7f7;border:1px solid #eee;padding:10px;word-break:break-all">
        ${widgetUrl}
      </div>
      <p style="margin-top:18px;font-size:13px;color:#333">
        ¿Dudas? Escríbeme a <a href="mailto:emiliagrijalvao@gmail.com">emiliagrijalvao@gmail.com</a>.
      </p>
      <p style="margin-top:6px;font-size:12px;color:#666">© 2025 Flujo Creativo</p>
    </div>
  </div>`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to,
      subject: 'Tu widget de Instagram Grid está listo',
      html,
    }),
  });

  if (!r.ok) {
    const err = await r.text().catch(() => null);
    console.error('Resend error:', err || r.status);
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const { notionToken, gridDbUrl, bioDbUrl, email, plan } = req.body || {};
    if (!notionToken || !gridDbUrl) {
      return res.status(400).json({ success: false, error: 'Faltan campos' });
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !BASE_URL) {
      return res
        .status(500)
        .json({ success: false, error: 'Faltan variables de entorno en el servidor' });
    }

    const widgetId = await createWidgetInSupabase({
      notionToken,
      gridDbUrl,
      bioDbUrl,
      email,
      plan,
    });

    const widgetUrl = `${BASE_URL.replace(/\/+$/, '')}/widget?id=${encodeURIComponent(widgetId)}`;

    await sendEmail(email, widgetUrl);

    return res.status(200).json({ success: true, widgetId, widgetUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: String(err.message || err) });
  }
}
