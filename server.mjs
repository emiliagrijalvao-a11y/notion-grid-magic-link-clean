/**
 * Uso:
 * 1) `npm i`
 * 2) (opcional) crea `.env` con NOTION_GRID_API_URL=https://TU-ENDPOINT/api/grid
 * 3) `npm start`
 * 4) Abre:
 *    - http://localhost:3000/          → portada "STATIC OK"
 *    - http://localhost:3000/api/grid  → JSON (proxy o demo)
 *    - http://localhost:3000/grid.html → UI del grid
 */
import "dotenv/config"; // ← carga .env automáticamente (necesita "dotenv" en package.json)
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.disable("x-powered-by");
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(__dirname, "public");

// Estáticos primero
app.use(
  express.static(PUB, {
    extensions: ["html"],
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-store");
    },
  })
);

// Health
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, envLoaded: !!process.env.NOTION_GRID_API_URL });
});

// Grid (proxy si hay NOTION_GRID_API_URL; demo si no)
app.get("/api/grid", async (_req, res) => {
  try {
    const upstream = process.env.NOTION_GRID_API_URL;

    if (upstream) {
      const r = await fetch(upstream, { headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error(`Upstream ${r.status}`);
      const j = await r.json();
      return res.json(j);
    }

    // Demo estable
    const demoItems = Array.from({ length: 12 }).map((_, i) => ({
      id: `demo-${String(i + 1).padStart(2, "0")}`,
      title: i % 3 === 0 ? "IG — Carousel" : "TikTok — BTS Clip",
      caption: "Contenido de prueba. Reemplaza con tu fuente real usando NOTION_GRID_API_URL.",
      href: "https://example.com",
      image: `https://picsum.photos/seed/grid${i}/900/900`,
      created_time: new Date().toISOString(),
      last_edited_time: new Date().toISOString(),
    }));

    res.json({ ok: true, usingClient: false, count: demoItems.length, items: demoItems });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Fallback a index
app.get("*", (_req, res) => {
  res.sendFile(path.join(PUB, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`→ http://localhost:${PORT}`);
});
