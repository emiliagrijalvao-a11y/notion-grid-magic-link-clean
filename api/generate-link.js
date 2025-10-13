// /api/generate-link.js
export default async function handler(req, res) {
  // CORS + preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  try {
    const { email } = req.body || {};
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "missing email" });
    }

    // Supabase REST
    const baseRaw = process.env.SUPABASE_URL || "";
    const baseNoSlash = baseRaw.replace(/\/+$/, "");
    const root = baseNoSlash.replace(/\/rest\/v1$/i, "");
    const REST = `${root}/rest/v1`;
    const key = process.env.SUPABASE_SERVICE_ROLE;
    if (!root || !key) return res.status(500).json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE" });

    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    // 1) Buscar customer por email
    let r = await fetch(
      `${REST}/customers?email=eq.${encodeURIComponent(email)}&select=id&limit=1`,
      { headers }
    );
    let data = r.ok ? await r.json() : null;
    let customer_id = Array.isArray(data) && data[0]?.id;

    // 2) Crear si no existe
    if (!customer_id) {
      r = await fetch(`${REST}/customers`, {
        method: "POST",
        headers,
        body: JSON.stringify({ email }),
      });
      if (!r.ok) {
        const text = await r.text();
        await fetch(`${REST}/logs`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            event: "generate-link-error",
            detail: { status: r.status, body: text.slice(0, 500) },
          }),
        });
        return res.status(500).json({ error: "supabase insert error", status: r.status, body: text.slice(0, 200) });
      }
      data = await r.json();
      customer_id = Array.isArray(data) ? data[0]?.id : data?.id;
    }

    // 3) Construir link
    const base = (process.env.BASE_URL || `https://${req.headers.host}`).replace(/\/$/, "");
    const link = `${base}/mi-cuenta.html?customer_id=${encodeURIComponent(customer_id)}`;

    // 4) Log
    await fetch(`${REST}/logs`, {
      method: "POST",
      headers,
      body: JSON.stringify({ customer_id, event: "generate-link-ok", detail: { email } }),
    });

    return res.status(200).json({ link, customer_id });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "unknown error" });
  }
}
