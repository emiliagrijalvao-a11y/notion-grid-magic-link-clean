// server.mjs (Node 18+, ESM)
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const app = express();
app.disable("x-powered-by");
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(__dirname, "public");

// ─────────────────────────────────────────────────────────────────────────────
// STORE EN MEMORIA (demo). Prod: persistir en DB.
// token -> { upstreamUrl: string|null, settings: object, createdAt: number }
const store = new Map();

// Helper: token aleatorio (12 chars url-safe)
function makeToken(n = 12) {
  return crypto.randomBytes(n).toString("base64url");
}

// DEMO items seguros (12 imágenes)
function demoPayload() {
  const items = Array.from({ length: 12 }).map((_, i) => ({
    id: `demo-${String(i + 1).padStart(2, "0")}`,
    title: i % 3 === 0 ? "IG — Carousel" : "TikTok — BTS Clip",
    caption:
      "Demo. Configura tu fuente real en el paso 1 del wizard o via NOTION_GRID_API_URL.",
    href: "https://example.com",
    image: `https://picsum.photos/seed/grid${i}/900/900`,
    created_time: new Date().toISOString(),
    last_edited_time: new Date().toISOString(),
  }));
  return { ok: true, usingClient: false, count: items.length, items };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) ESTÁTICOS PRIMERO (para no colisionar /grid.html con /api)
app.use(
  express.static(PUB, {
    extensions: ["html"],
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-store");
    },
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// 2) API (salud, grid genérico, magic-link, grid por token, config)

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, envLoaded: !!process.env.NOTION_GRID_API_URL });
});

// /api/grid → mantiene compatibilidad (usa env o demo)
app.get("/api/grid", async (_req, res) => {
  try {
    const upstream = process.env.NOTION_GRID_API_URL;
    if (upstream) {
      const r = await fetch(upstream, { headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error(`Upstream ${r.status}`);
      return res.json(await r.json());
    }
    return res.json(demoPayload());
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Crea Magic Link (demo). Body: { email?:string, upstreamUrl?:string }
app.post("/api/magic", (req, res) => {
  const { email = "", upstreamUrl = "" } = req.body || {};
  const token = makeToken(9);
  const createdAt = Date.now();

  // Si no pasas upstreamUrl aquí, podrás definirla en el Wizard (Paso 1)
  store.set(token, {
    upstreamUrl: upstreamUrl || null,
    settings: {},
    createdAt,
    email,
  });

  const base = `${req.protocol}://${req.get("host")}`;
  const setupLink = `${base}/setup/index.html?token=${encodeURIComponent(token)}`;

  res.json({ ok: true, token, setupLink });
});

// Lee grid por token (usa upstream del token, o env global, o demo)
app.get("/api/widgets/:token/grid", async (req, res) => {
  try {
    const token = req.params.token;
    const rec = store.get(token) || null;

    const upstreamCandidate =
      (rec && rec.upstreamUrl) || process.env.NOTION_GRID_API_URL || null;

    if (upstreamCandidate) {
      const r = await fetch(upstreamCandidate, { headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error(`Upstream ${r.status}`);
      return res.json(await r.json());
    }

    return res.json(demoPayload());
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Guarda config del token (Paso 1 y ajustes del Wizard)
// Body: { upstreamUrl?: string, settings?: object }
app.post("/api/widgets/:token/config", (req, res) => {
  const token = req.params.token;
  const rec = store.get(token);
  if (!rec) return res.status(404).json({ ok: false, error: "Token no encontrado" });

  const { upstreamUrl, settings } = req.body || {};
  if (typeof upstreamUrl === "string") rec.upstreamUrl = upstreamUrl.trim() || null;
  if (settings && typeof settings === "object") rec.settings = { ...rec.settings, ...settings };

  store.set(token, rec);
  res.json({ ok: true, token, data: rec });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3) Fallback a index.html
app.get("*", (_req, res) => {
  res.sendFile(path.join(PUB, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`→ http://localhost:${PORT}`);
});
