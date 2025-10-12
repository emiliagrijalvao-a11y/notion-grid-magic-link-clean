// /api/widgets/create.js
export const config = { runtime: 'nodejs' };

import fetch from 'node-fetch';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE, RESEND_API_KEY, FROM_EMAIL, BASE_URL } = process.env;

async function createWidgetInSupabase(payload){
  const url = `${SUPABASE_URL}/rest/v1/rpc/api_create_widget`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_ROLE,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      p_email: payload.email || null,
      p_plan:  payload.plan  || 'pro',
      p_notion_token: payload.notionToken,
      p_grid_db_url:  payload.gridDbUrl,
      p_bio_db_url:   payload.bioDbUrl || null
    })
  });

  if(!r.ok){
    const txt = await r.text().catch(()=>null);
    throw new Error(`Supabase RPC error: ${txt || r.status}`);
  }
  
  const data = await r.json();
  const first = Array.isArray(data) ? data[0] : data;
  if(!first || !first.widget_id){
    throw new Error('Respuesta RPC sin widget_id');
  }
  return first.widget_id;
}

async function sendEmail(to, widgetUrl){
  // SI NO HAY EMAIL, NO ENVIAMOS (pero no es error)
  if(!to || !RESEND_API_KEY || !FROM_EMAIL){
    console.log('⚠️ Email no enviado - falta email del cliente o config de Resend');
    return;
  }

  console.log(`📧 Enviando email a: ${to}`);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:'Inter',Arial,sans-serif;background-color:#D9D9D9;">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
    
    <!-- Header -->
    <div style="background:#000000;color:#ffffff;padding:32px 24px;text-align:center;">
      <h1 style="margin:0;font-family:'Oswald',Arial,sans-serif;font-size:28px;letter-spacing:1px;text-transform:uppercase;">
        Flujo Creativo
      </h1>
      <p style="margin:8px 0 0 0;font-size:14px;opacity:0.9;">
        Tu Instagram Grid Preview está listo
      </p>
    </div>

    <!-- Body -->
    <div style="padding:40px 24px;">
      <h2 style="margin:0 0 16px 0;font-size:22px;color:#000000;">
        ¡Gracias por tu compra! 🎉
      </h2>
      
      <p style="margin:0 0 16px 0;line-height:1.6;color:#333333;font-size:16px;">
        Ya tienes acceso a tu widget personalizado. Para empezar:
      </p>

      <ol style="margin:0 0 24px 0;padding-left:20px;line-height:1.8;color:#333333;">
        <li><strong>Guarda este link</strong> - es tu acceso personal al setup</li>
        <li><strong>Conéctalo a Notion</strong> siguiendo las instrucciones</li>
        <li><strong>¡Listo!</strong> Tu grid de Instagram aparecerá en tiempo real</li>
      </ol>

      <!-- CTA Button -->
      <div style="text-align:center;margin:32px 0;">
        <a href="${widgetUrl}" 
           style="display:inline-block;background:#000000;color:#ffffff;padding:16px 40px;text-decoration:none;border-radius:4px;font-weight:600;font-size:16px;">
          Configurar mi Widget →
        </a>
      </div>

      <!-- URL Copy Box -->
      <div style="background:#f7f7f7;border:1px solid #e0e0e0;border-radius:4px;padding:16px;margin:24px 0;">
        <p style="margin:0 0 8px 0;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:0.5px;">
          Tu Setup URL:
        </p>
        <code style="display:block;font-family:monospace;font-size:13px;color:#000;word-break:break-all;">
          ${widgetUrl}
        </code>
      </div>

      <p style="margin:24px 0 0 0;padding:20px 0 0 0;border-top:1px solid #e0e0e0;font-size:14px;color:#666;line-height:1.6;">
        <strong>¿Necesitas ayuda?</strong><br>
        Escríbeme a <a href="mailto:emiliagrijalvao@gmail.com" style="color:#000000;">emiliagrijalvao@gmail.com</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f9f9f9;padding:20px 24px;text-align:center;border-top:1px solid #e0e0e0;">
      <p style="margin:0;font-size:12px;color:#999;">
        © 2025 Flujo Creativo - Visualiza tu contenido como merece
      </p>
    </div>

  </div>
</body>
</html>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to,
        subject: '¡Tu Instagram Grid está listo! 🎨',
        html
      })
    });

    if(!r.ok){
      const errorText = await r.text().catch(() => 'Unknown error');
      console.error('❌ Resend API error:', errorText);
      throw new Error(`Resend error: ${errorText}`);
    }

    const result = await r.json();
    console.log('✅ Email enviado exitosamente:', result.id);
    return result;

  } catch(error) {
    console.error('❌ Error enviando email:', error);
    // NO lanzamos el error - queremos que el widget se cree igual
    return null;
  }
}

export default async function handler(req, res){
  try{
    if(req.method !== 'POST') {
      return res.status(405).json({success:false, error:'Method Not Allowed'});
    }

    const { notionToken, gridDbUrl, bioDbUrl, email, plan } = req.body || {};
    
    // Validaciones básicas
    if(!notionToken || !gridDbUrl){
      return res.status(400).json({
        success:false,
        error:'Faltan campos requeridos: notionToken y gridDbUrl'
      });
    }

    // Validar variables de entorno
    if(!SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !BASE_URL){
      console.error('❌ Faltan variables de entorno críticas');
      return res.status(500).json({
        success:false,
        error:'Configuración del servidor incompleta'
      });
    }

    // Log para debugging
    console.log('📝 Creando widget para:', email || 'sin email');

    // 1. Crear widget en Supabase
    const widgetId = await createWidgetInSupabase({ 
      notionToken, 
      gridDbUrl, 
      bioDbUrl, 
      email, 
      plan 
    });

    // 2. Construir URL del widget
    const widgetUrl = `${BASE_URL.replace(/\/+$/,'')}/setup?id=${encodeURIComponent(widgetId)}`;

    // 3. Enviar email (no bloqueante)
    if(email) {
      await sendEmail(email, widgetUrl).catch(err => {
        console.error('⚠️ Email falló pero widget creado:', err.message);
      });
    }

    // 4. Responder con éxito
    return res.status(200).json({ 
      success: true, 
      widgetId, 
      widgetUrl,
      emailSent: !!email 
    });

  } catch(err) {
    console.error('❌ Error en /api/widgets/create:', err);
    return res.status(500).json({ 
      success: false, 
      error: String(err.message || err) 
    });
  }
}
