// api/grid.js
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

const NOTION_VERSION = "2022-06-28";

async function notionQuery(dbId, token) {
  const r = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sorts: [{ property: "Publish Date", direction: "descending" }],
      page_size: 50
    })
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Notion ${r.status}: ${t}`);
  }
  const j = await r.json();
  return j;
}

function extractFirstFile(prop) {
  if (!prop || prop.type !== "files" || !Array.isArray(prop.files) || prop.files.length === 0) return null;
  const f = prop.files[0];
  if (f.type === "file") return f.file.url;
  if (f.type === "external") return f.external.url;
  return null;
}

function extractTitle(titleProp) {
  if (!titleProp || !Array.isArray(titleProp.title)) return "";
  return titleProp.title.map(t => t.plain_text).join("").trim();
}

export default async function handler(req, res) {
  try {
    const { id } = req.query;

    // Si viene id, resolvemos widget -> DB + token
    if (id) {
      const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } });
      const w = await sb.from("fc_widgets").select("database_id, notion_token").eq("id", id).maybeSingle();
      if (w.error) throw w.error;
      if (!w.data) return res.status(404).json({ ok: false, error: "Widget no encontrado" });

      const dbId = w.data.database_id;
      const token = w.data.notion_token || process.env.NOTION_TOKEN; // fallback global si quieres
      if (!token) return res.status(400).json({ ok: false, error: "No hay token de Notion" });

      const j = await notionQuery(dbId, token);

      const items = (j.results || []).map(page => {
        const props = page.properties || {};
        const title = extractTitle(props["Name"]);
        const attachment = extractFirstFile(props["Attachment"]);
        const linkProp = props["Link"] && props["Link"].type === "rich_text"
          ? (props["Link"].rich_text[0]?.plain_text || null)
          : null;

        return {
          id: page.id,
          title,
          image: attachment || linkProp || null,
          created_time: page.created_time,
          last_edited_time: page.last_edited_time,
          href: linkProp || null
        };
      }).filter(x => !!x.image);

      return res.status(200).json({ ok: true, usingClient: false, count: items.length, items });
    }

    // DEMO (sin id)
    const demoItems = Array.from({ length: 12 }).map((_, i) => ({
      id: `demo-${String(i + 1).padStart(2, "0")}`,
      title: i % 3 === 0 ? "IG — Carousel" : "TikTok — BTS Clip",
      href: "https://example.com",
      image: `https://picsum.photos/seed/grid${i}/900/900`,
      created_time: new Date().toISOString(),
      last_edited_time: new Date().toISOString(),
    }));
    return res.status(200).json({ ok: true, usingClient: false, count: demoItems.length, items: demoItems });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
