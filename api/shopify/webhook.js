// /api/shopify/webhook.js (ESM compatible)
export const config = { api: { bodyParser: false } };

import crypto from "crypto";
import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  // Leer raw body para HMAC
  const raw = await new Promise((resolve, reject) => {
    let data = [];
    req.on("data", chunk => data.push(chunk));
    req.on("end", () => resolve(Buffer.concat(data)));
    req.on("error", reject);
  });

  // HMAC opcional
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (secret) {
    const hmacHeader = req.headers["x-shopify-hmac-sha256"];
    const generated = crypto.createHmac("sha256", secret).update(raw).digest("base64");
    if (hmacHeader !== generated) return res.status(401).json({ ok: false, error: "Invalid HMAC" });
  }

  let order = {};
  try { order = JSON.parse(raw.toString("utf-8")); }
  catch (e) { return res.status(400).json({ ok: false, error: "Invalid JSON" }); }

  // ...AQUI VA TU LÓGICA DE INTEGRACION Supabase/Resend...

  return res.status(200).json({ ok: true });
}
