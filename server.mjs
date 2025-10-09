// server.mjs
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.disable("x-powered-by");
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(__dirname, "public");

// 1) ESTÁTICOS PRIMERO (para que /grid.html nunca caiga en /api)
app.use(express.static(PUB, {
  extensions: ["html"],
  setHeaders(res, filePath) {
    if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-store");
  }
}));

// 2) API
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, envLoaded: !!process.env.NOTION_GRID_API_URL });
});

app.get("/api/grid", async (_req, res) => {
  try {
    // Si definiste NOTION_GRID_API_URL, proxyea a tu fuente real:
    const upstream = process.env.NOTION_GRID_API_URL;
    if (upstream) {
      const r = await fetch(upstream, { headers: { "Accept": "application/json" } });
      const j = await r.json();
      return res.json(j);
    }

    // DEMO segura (puedes borrar este bloque cuando uses tu upstream)
    res.json({
      ok: true,
      usingClient: false,
      count: 0,
      items: []
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// 3) Fallback a index.html para rutas no-API y no-estáticas
app.get("*", (_req, res) => {
  res.sendFile(path.join(PUB, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`→ http://localhost:${PORT}`);
});
