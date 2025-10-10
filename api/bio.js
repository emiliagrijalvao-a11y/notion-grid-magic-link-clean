// api/bio.js
const NOTION_API = "https://api.notion.com/v1";

export default async function handler(req, res) {
  try {
    const token = process.env.NOTION_TOKEN;
    const db = process.env.NOTION_BIO_DATABASE_ID;
    if (!token || !db) {
      return res.status(500).json({ ok: false, error: "Faltan NOTION_TOKEN o NOTION_BIO_DATABASE_ID." });
    }

    const slug = (req.query.slug || "").trim();

    // 1) Query a la DB (filtra por Slug si viene)
    const queryBody = slug
      ? {
          filter: { property: "Slug", rich_text: { equals: slug } },
          page_size: 1
        }
      : { page_size: 1 };

    const q = await fetch(`${NOTION_API}/databases/${db}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(queryBody)
    });
    if (!q.ok) {
      const txt = await q.text();
      throw new Error(`Notion query ${q.status}: ${txt}`);
    }
    const qr = await q.json();
    const page = (qr.results && qr.results[0]) || null;
    if (!page) {
      return res.status(404).json({ ok: false, error: "No se encontró ninguna fila en Bio Settings." });
    }

    // 2) Helpers para extraer texto
    const rtToText = (rtArr) =>
      Array.isArray(rtArr) ? rtArr.map((r) => (r.plain_text ?? "")).join("") : "";

    const get = (name) => page.properties?.[name];

    // 3) Extraer campos
    const name =
      (get("Name")?.title && get("Name").title.length ? get("Name").title[0].plain_text : "") || "";

    const username = (get("Username")?.rich_text ? rtToText(get("Username").rich_text) : get("Username")?.plain_text) || "";

    const bioTxt =
      (get("Bio")?.rich_text ? rtToText(get("Bio").rich_text) : get("Bio")?.plain_text) || "";

    const avatarUrlProp = get("Avatar URL")?.url || "";

    // Avatar (prioridad: URL → Files&Media)
    let avatar = avatarUrlProp;
    if (!avatar) {
      const files = get("Avatar")?.files || [];
      if (files.length) {
        const f = files[0];
        avatar = f.external?.url || f.file?.url || "";
      }
    }

    // Links y Socials: multilinea "Label | URL"
    const parseLines = (prop) => {
      const raw =
        (prop?.rich_text ? rtToText(prop.rich_text) : prop?.plain_text) || "";
      return raw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => {
          const [label, href] = line.split("|").map((s) => (s || "").trim());
          if (!href) return null;
          return { label: label || href, href };
        })
        .filter(Boolean);
    };

    const links = parseLines(get("Links"));
    const socials = parseLines(get("Socials"));

    const out = {
      ok: true,
      profile: {
        name,
        username,
        bio: bioTxt,
        avatar,
        socials
      },
      links
    };

    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
