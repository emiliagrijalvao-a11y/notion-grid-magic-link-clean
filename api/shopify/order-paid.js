// api/shopify/order-paid.js
export const config = { runtime: "nodejs" };

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// ── ENV requeridas ─────────────────────────────────────────────
// SHOPIFY_WEBHOOK_SECRET  → el “Webhook API secret” de Shopify
// SUPABASE_URL
// SUPABASE_SERVICE_ROLE
// BASE_URL                → https://tu-deploy.vercel.app
// FROM_EMAIL              → remitente en Resend (opcional: para enviar mail)
// RESEND_API_KEY          → API key de Resend (opcional)
// SHOPIFY_PRO_KEYWORD     → palabra para detectar PRO en el título/SKU (ej: "Pro")
// ───────────────────────────────────────────────────────────────

const sb = () =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false },
  });

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = [];
    req
      .on("data", (chunk) => data.push(chunk))
      .on("end", () => resolve(Buffer.concat(data)))
      .on("error", reject);
  });
}

function safeJsonParse(buf) {
  try {
    return JSON.parse(buf.toString("utf8"));
  } catch {
    return null;
  }
}

async function sendEmail(to, subject, html) {
  if (!process.env.RESEND_API_KEY || !process.env.FROM_EMAIL) return;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.FROM_EMAIL,
      to,
      subject,
      html,
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    console.error("Resend error:", r.status, t);
  }
}

function detectPlan(lineItems, keyword = "Pro") {
  const k = (keyword || "Pro").toLowerCase();
  for (const li of lineItems || []) {
    const t = `${li.title || ""} ${li.sku || ""}`.toLowerCase();
    if (t.includes(k)) return "pro";
  }
  return "basic";
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

    // 1) Verificar HMAC
    const raw = await readRawBody(req);
    const sig = req.headers["x-shopify-hmac-sha256"];
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET || "";
    const digest = crypto.createHmac("sha256", secret).update(raw).digest("base64");
    if (sig !== digest) return res.status(401).json({ ok: false, error: "Invalid HMAC" });

    // 2) Parsear payload
    const body = safeJsonParse(raw);
    if (!body) return res.status(400).json({ ok: false, error: "Invalid JSON" });

    const email =
      body.email ||
      body.contact_email ||
      body.customer?.email ||
      body?.customer?.default_address?.email ||
      null;
    if (!email) return res.status(200).json({ ok: true, note: "No email in order; skipping." });

    const orderId = String(body.id || body.name || "");
    const plan = detectPlan(body.line_items, process.env.SHOPIFY_PRO_KEYWORD);

    // 3) Upsert usuario y crear licencia activa
    const supa = sb();
    await supa.from("fc_users").upsert({ email }, { onConflict: "email" });

    const lic = await supa.from("fc_licenses").insert({
      email,
      order_id: orderId,
      status: "active",
      plan, // 'pro' si detectó keyword; si no, 'basic'
    });
    if (lic.error) throw lic.error;

    // 4) (Opcional) enviar mail con el enlace de Setup
    const setupUrl = `${process.env.BASE_URL}/setup/`;
    await sendEmail(
      email,
      "Tu acceso a Notion Grid · Flujo Creativo",
      `
      <div style="font-family:Inter,system-ui,sans-serif">
        <h2 style="margin:0 0 12px">¡Gracias por tu compra!</h2>
        <p>Ya activamos tu licencia <b>${plan.toUpperCase()}</b>.</p>
        <p>Configura tu widget aquí:</p>
        <p><a href="${setupUrl}" target="_blank">${setupUrl}</a></p>
        <p>Solo necesitarás tu <i>Notion Integration Token</i> y la URL de tu base de datos.</p>
        <hr />
        <p style="font-size:12px;color:#666">Si no fuiste tú, ignora este correo.</p>
      </div>
      `
    );

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
