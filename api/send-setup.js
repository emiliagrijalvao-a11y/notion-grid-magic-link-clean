// /api/send-setup.js
import { supabase } from "./_supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method Not Allowed" });

  try {
    const { email, name } = req.body || {};
    if (!email) return res.status(400).json({ ok: false, error: "Falta email" });

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const FROM_EMAIL = process.env.FROM_EMAIL || "no-reply@flujo-creativo.com";
    const BASE_URL = process.env.BASE_URL; // ej: https://notion-grid-magic-link-clean-git-main-flujo-creativo.vercel.app
    const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "emiliagrijalvao@gmail.com";

    if (!RESEND_API_KEY || !BASE_URL) {
      return res.status(500).json({ ok: false, error: "Faltan variables de entorno (RESEND_API_KEY o BASE_URL)" });
    }

    // Asegurar usuario
    await supabase
      .from("fc_users")
      .upsert({ email: email.toLowerCase(), name: name || null }, { onConflict: "email" });

    const setupUrl = `${BASE_URL}/setup.html?email=${encodeURIComponent(email.toLowerCase())}`;

    const html = `
      <div style="font-family:Inter,system-ui,-apple-system,sans-serif;color:#000">
        <h2 style="margin:0 0 8px">Tu enlace para configurar el Grid</h2>
        <p style="margin:0 0 18px">Guarda este URL — lo usarás cada vez que configures un widget.</p>
        <p>
          <a href="${setupUrl}" target="_blank"
             style="background:#000;color:#fff;padding:12px 18px;text-decoration:none;display:inline-block">
            Abrir Setup →
          </a>
        </p>
        <p style="margin:18px 0 8px"><strong>Enlace directo:</strong><br>
          <a href="${setupUrl}" target="_blank" style="color:#000">${setupUrl}</a>
        </p>
        <hr style="border:none;border-top:1px solid #ddd;margin:20px 0"/>
        <p style="font-size:13px;margin:0">¿Necesitas ayuda? Escríbeme a
          <a href="mailto:${SUPPORT_EMAIL}" style="color:#000">${SUPPORT_EMAIL}</a>.
        </p>
        <p style="font-size:12px;margin:4px 0 0;opacity:.7">© 2025 Flujo Creativo · Sistema Notion Grid</p>
      </div>
    `;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: "Tu link de Setup — Flujo Creativo",
        html
      })
    });
    const data = await r.json();

    // Log email
    await supabase.from("fc_email_logs").insert({
      to_email: email.toLowerCase(),
      subject: "Tu link de Setup — Flujo Creativo",
      provider_id: data?.id || null,
      status: r.ok ? "sent" : "error"
    });

    if (!r.ok) {
      return res.status(500).json({ ok: false, error: data?.message || "Error al enviar email" });
    }

    return res.json({ ok: true, id: data?.id, setupUrl });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
