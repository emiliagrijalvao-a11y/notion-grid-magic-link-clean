// /api/send-setup.js
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    const { email, name } = req.body || {};
    if (!email) return res.status(400).json({ ok: false, error: 'Missing email' });

    const BASE = (process.env.BASE_URL || '').replace(/\/$/, '');
    if (!BASE) return res.status(500).json({ ok: false, error: 'Missing BASE_URL' });

    const setupUrl = `${BASE}/setup/?email=${encodeURIComponent(email)}`;

    // Resend (modo testing sin dominio):
    const FROM = process.env.FROM_EMAIL || 'onboarding@resend.dev';
    const TEST_TO = process.env.RESEND_TEST_TO; // ← tu correo de la cuenta Resend
    const TO = FROM.endsWith('@resend.dev') && TEST_TO ? TEST_TO : email;

    const subject = 'Tu enlace de Setup — Flujo Creativo';
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.6">
        <p>Hola${name ? ' ' + name : ''},</p>
        <p>Aquí está tu enlace para configurar el widget:</p>
        <p><a href="${setupUrl}">${setupUrl}</a></p>
        <p>Guárdalo. Si necesitas ayuda, escribe a ${process.env.SUPPORT_EMAIL || 'emiliagrijalvao@gmail.com'}.</p>
      </div>
    `;

    // Llamada directa a la API de Resend (sin SDK)
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from: FROM, to: TO, subject, html })
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      // Fallback: aunque Resend bloquee el envío, devolvemos el setupUrl para continuar
      return res.status(200).json({
        ok: true,
        setupUrl,
        warning: err?.message || 'Email blocked in testing mode'
      });
    }

    const data = await r.json().catch(() => ({}));
    return res.json({ ok: true, setupUrl, providerId: data?.id || null });
  } catch (e) {
    return res.status(200).json({ ok: true, setupUrl: null, warning: String(e) });
  }
}
