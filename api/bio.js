export default async function handler(req, res) {
  try {
    const upstream = process.env.NOTION_BIO_API_URL; // si lo tienes, proxyea
    if (upstream) {
      const r = await fetch(upstream, { headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error(`Upstream ${r.status}`);
      const j = await r.json();
      // Esperamos un JSON con { ok, profile, links }
      return res.status(200).json(j);
    }

    // DEMO seguro (para que puedas embeber YA)
    const demo = {
      ok: true,
      profile: {
        name: "Flujo Creativo",
        username: "flujo_creativo",
        avatar: "https://picsum.photos/seed/flujo/300/300",
        bio: "Contenido, herramientas y plantillas para creators. Todo en tu Notion.",
        socials: [
          { label: "Instagram", href: "https://instagram.com" },
          { label: "Notion", href: "https://notion.so" }
        ]
      },
      links: [
        { label: "Ver el Grid en vivo", href: "/widget/demo?v=1" },
        { label: "Comprar el Widget", href: "https://tu-tienda.myshopify.com" },
        { label: "Tutorial rápido", href: "/setup" }
      ]
    };
    return res.status(200).json(demo);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
