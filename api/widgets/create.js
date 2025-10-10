export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method not allowed" });

    const { notionToken, databaseUrl } = req.body || {};
    if (!notionToken || !databaseUrl)
      return res.status(400).json({ ok:false, error:"notionToken y databaseUrl son requeridos" });

    // TODO: aquí guardaríamos en Supabase el widget con su fuente (pendiente)
    // Por ahora, generamos un ID aleatorio y devolvemos la URL para embeber:
    const id = Math.random().toString(36).slice(2, 8);
    const base = process.env.BASE_URL || `https://${req.headers.host}`;
    const widgetUrl = `${base.replace(/\/$/,"")}/widget/${id}`;

    return res.json({ ok:true, widgetId:id, widgetUrl });
  } catch (err) {
    return res.status(500).json({ ok:false, error:String(err) });
  }
}
