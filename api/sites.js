export default async function handler(req, res) {
  try {
    const { customer_id } = req.query;
    if (!customer_id) {
      return res.status(400).json({ error: "missing customer_id" });
    }

    // Consulta REST a Supabase (POSTgREST) sin instalar librerías
    const base = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE; // solo en servidor
    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
    };

    // 1) Leer sites del cliente
    const url = `${base}/rest/v1/sites?customer_id=eq.${customer_id}&select=id,notion_database_id,created_at&order=created_at.desc`;
    const r = await fetch(url, { headers });
    if (!r.ok) {
      const text = await r.text();
      // Log de error
      await fetch(`${base}/rest/v1/logs`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          customer_id,
          event: "api-sites-error",
          detail: { status: r.status, message: text },
        }),
      });
      return res.status(500).json({ error: text || "supabase error" });
    }
    const data = await r.json();

    // 2) Log OK
    await fetch(`${base}/rest/v1/logs`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        customer_id,
        event: "api-sites-ok",
        detail: { count: Array.isArray(data) ? data.length : 0 },
      }),
    });

    return res.status(200).json(Array.isArray(data) ? data : []);
  } catch (e) {
    return res.status(500).json({ error: e?.message || "unknown error" });
  }
}
