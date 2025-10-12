const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL || 'Flujo Creativo <noreply@example.com>';

// Función para generar token simple pero seguro
function generateAccessToken() {
  return crypto.randomBytes(32).toString('hex'); // 64 caracteres hexadecimales
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
      
      // Si no tiene token, generarle uno
      if (!accessToken) {
        accessToken = generateAccessToken();
        await supabaseAdmin
          .from('clients')
          .update({ access_token: accessToken, name })
          .eq('id', clientId);
      }
    } else {
      // Cliente nuevo: crear con token
      accessToken = generateAccessToken();
      const { data: newClient, error: errClient } = await supabaseAdmin
        .from('clients')
        .insert({ email, name, access_token: accessToken })
        .select('id')
        .single();
      
      if (errClient) throw errClient;
      clientId = newClient.id;
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

    // 3. URL con el token simple
    const accountUrl = `${process.env.BASE_URL}/setup.html?token=${accessToken}`;

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

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[webhook error]', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
};

module.exports.config = {
  api: { bodyParser: false }
};
