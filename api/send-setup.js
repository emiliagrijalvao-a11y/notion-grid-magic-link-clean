// /api/send-setup.js
import { supabase } from "./_supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method Not Allowed" });

  try {
    const { email, name } = req.body || {};
    if (!email) return res.status(400).json({ ok: false, error: "Falta email" });

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.FROM_EMAIL || "no-reply@example.com";
    const baseUrl = process.env.BASE_URL;
    const support = process.env.SUPPORT_EMAIL || "support@example.com";
    if (!apiKey || !baseUrl) {
      return res.status(500).json({ ok: false, error: "Faltan variables de entorno (RESEND_API_KEY o BASE_URL)" });
    }

    // Upsert usuario
    await supabase
      .from("fc_users")
      .upsert({ email, name: name || null }, { onConflict: "email" });

    // Link al setup con email (para que Account lo cargue)
    const setupUrl = `${baseUrl}/setup.html?email=${encodeURIComponent(email)}`;

    const html = `
      <div style="font-family:Inter,system-ui,-apple-system,sans-serif; color:#000">
        <h2 style="margin:0 0 8px">Tu enlace para configurar el Grid</h2>
        <p style="margin:0 0 18px">Guarda este URL — es tu acceso directo al Setup.</p>
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
        <p style="font-size:13px;margin:0">
          ¿Necesitas ayuda? Escríbeme a <a href="mailto:${support}" style="color:#000">${support}</a>.
        </p>
        <p style="font-size:12px;margin:4px 0 0;opacity:.7">© 2025 Flujo Creativo · Sistema Notion Grid</p>
      </div>
    `;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Tu link de Setup — Flujo Creativo",
        html,
      }),
    });
    const data = await r.json();

    // Log de email
    await supabase.from("fc_email_logs").insert({
      to_email: email,
      subject: "Tu link de Setup — Flujo Creativo",
      provider_id: data?.id || null,
      status: r.ok ? "sent" : "error",
    });

    if (!r.ok) {
      return res.status(500).json({ ok: false, error: data?.message || "Error al enviar email" });
    }

    return res.json({ ok: true, id: data?.id, setupUrl });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
