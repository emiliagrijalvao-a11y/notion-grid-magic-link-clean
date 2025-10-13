// api/generate-link.js
export default async function handler(req, res) {
  // CORS / preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }

  try {
    const { email } = req.body || {};
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "missing email" });
    }

    // Normaliza SUPABASE_URL
    const baseRaw = process.env.SUPABASE_URL || "";
    const baseNoSlash = baseRaw.replace(/\/+$/, "");
    const root = baseNoSlash.replace(/\/rest\/v1$/i, "");
    const REST = `${root}/rest/v1`;

    const key = process.env.SUPABASE_SERVICE_ROLE;
    if (!root || !key) {
      return res.status(500).json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE" });
    }

    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation,resolution=merge-duplicates"
    };

    // UPSERT por email (email UNIQUE)
    const upsert = await fetch(`${REST}/customers?on_conflict=email`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email })
    });
    const bodyText = await upsert.text();
    if (!upsert.ok) {
      return res.status(500).json({ error: "customers upsert error", status: upsert.status, body: bodyText.slice(0,500) });
    }
    const rows = bodyText ? JSON.parse(bodyText) : [];
    const customer = Array.isArray(rows) ? rows[0] : rows;
    const customer_id = customer?.id;
    if (!customer_id) {
      return res.status(500).json({ error: "no customer id returned" });
    }

    // Construye link a la cuenta
    const proto = (req.headers["x-forwarded-proto"] || "https");
    const host  = req.headers.host;
    const link  = `${proto}://${host}/mi-cuenta.html?customer_id=${customer_id}`;

    // Log
    await fetch(`${REST}/logs`, {
      method: "POST",
      headers,
      body: JSON.stringify({ customer_id, event: "generate-link-ok", detail: { email } })
    });

    return res.status(200).json({ link, customer_id });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "unknown error" });
  }
}
