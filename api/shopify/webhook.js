const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL || 'Flujo Creativo <noreply@example.com>';

function generateAccessToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function readRawBody(req) {
  return await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const raw = await readRawBody(req);
    let order = {};
    try { 
      order = JSON.parse(raw); 
    } catch { 
      return res.status(400).json({ ok: false, error: 'Invalid JSON' }); 
    }

    const email = order?.email || order?.customer?.email;
    const firstName = order?.customer?.first_name || '';
    const lastName = order?.customer?.last_name || '';
    const name = `${firstName} ${lastName}`.trim() || null;

    if (!email) {
      return res.status(400).json({ ok: false, error: 'No email in order' });
    }

    console.log('[webhook] Processing order for:', email);

    // 1. Buscar o crear cliente CON TOKEN
    const { data: existing } = await supabaseAdmin
      .from('clients')
      .select('id, access_token')
      .eq('email', email)
      .maybeSingle();

    let clientId, accessToken;
    
    if (existing?.id) {
      clientId = existing.id;
      accessToken = existing.access_token;
      
      if (!accessToken) {
        accessToken = generateAccessToken();
        await supabaseAdmin
          .from('clients')
          .update({ access_token: accessToken, name })
          .eq('id', clientId);
        console.log('[webhook] Token generated for existing client:', clientId);
      }
    } else {
      accessToken = generateAccessToken();
      const { data: newClient, error: errClient } = await supabaseAdmin
        .from('clients')
        .insert({ email, name, access_token: accessToken })
        .select('id')
        .single();
      
      if (errClient) throw errClient;
      clientId = newClient.id;
      console.log('[webhook] New client created:', clientId);
    }

    // 2. Crear widget
    const { data: widget, error: errWidget } = await supabaseAdmin
      .from('widgets')
      .insert({
        client_id: clientId,
        type: 'ig_grid',
        plan: 'pro',
        config: {}
      })
      .select('id')
      .single();

    if (errWidget) throw errWidget;
    console.log('[webhook] Widget created:', widget.id);

    // 3. URL con el token
    const accountUrl = `https://notion-grid-magic-link-clean.vercel.app/setup.html?token=${accessToken}`;

    // 4. Enviar email
    await resend.emails.send({
      from: FROM,
      to: [email],
      subject: 'Tu acceso a Instagram Grid - Flujo Creativo',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2>¡Gracias por tu compra!</h2>
          <p>Hola ${name || 'cliente'}, aquí tienes tu enlace de acceso:</p>
          <p style="margin:24px 0">
            <a href="${accountUrl}" style="display:inline-block;padding:12px 24px;background:#000;color:#fff;text-decoration:none;border-radius:4px">Abrir mi cuenta</a>
          </p>
          <p style="font-size:14px;color:#666">O copia este link en tu navegador:</p>
          <p style="font-size:13px;word-break:break-all;color:#333">${accountUrl}</p>
          <hr style="margin:32px 0;border:none;border-top:1px solid #ddd"/>
          <p style="font-size:13px;color:#666">¿Necesitas ayuda? Responde a este email.</p>
        </div>
      `
    });

    console.log('[webhook] Email sent to:', email);
    return res.status(200).json({ ok: true, clientId, widgetId: widget.id });
  } catch (e) {
    console.error('[webhook error]', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
};

module.exports.config = {
  api: { bodyParser: false }
};
