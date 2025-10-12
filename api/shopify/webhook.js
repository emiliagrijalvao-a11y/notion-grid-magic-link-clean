// /api/shopify/webhook.js

export const config = { api: { bodyParser: false } };

import crypto from 'crypto';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ ok: false, error: "Method not allowed" });

  // Leer raw body completo para HMAC y parseo
  const raw = await new Promise((resolve, reject) => {
    let data = [];
    req.on("data", chunk => data.push(chunk));
    req.on("end", () => resolve(Buffer.concat(data)));
    req.on("error", reject);
  });

  // --- Validar HMAC si usas SHOPIFY_WEBHOOK_SECRET ---
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (secret) {
    const hmacHeader = req.headers["x-shopify-hmac-sha256"];
    const generated = crypto.createHmac("sha256", secret).update(raw).digest("base64");
    if (hmacHeader !== generated)
      return res.status(401).json({ ok: false, error: "Invalid HMAC" });
  }

  // Parsear contenido
  let order = {};
  try { order = JSON.parse(raw.toString("utf-8")); }
  catch (e) { return res.status(400).json({ ok: false, error: "Invalid JSON" }); }

  // Validar email (en order.email directo o order.customer.email)
  const email = order.email || (order.customer && order.customer.email);
  if (!email)
    return res.status(400).json({ ok: false, error: "No email in order" });

  // VARIABLES
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const RESEND_FROM = process.env.RESEND_FROM;
  const BASE_URL = process.env.BASE_URL || "https://TU_DOMINIO/account";

  // 1. Crear/buscar cliente en Supabase
  const { id: client_id } = await upsertClient(email, order, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  if (!client_id)
    return res.status(500).json({ ok: false, error: "Can't create/find client" });

  // 2. Crear un widget (opcional: puedes omitir si no usas widgets por compra)
  const widget_id = await createWidget(client_id, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 3. Generar magic link y guardar en tabla
  const token = await createMagicLink(client_id, widget_id, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  if (!token)
    return res.status(500).json({ ok: false, error: "Can't create magic link" });

  // 4. Enviar email con Resend
  const enlace = `${BASE_URL}?t=${token}`;
  const enviado = await sendResendEmail(email, enlace, RESEND_API_KEY, RESEND_FROM);

  if (!enviado)
    return res.status(500).json({ ok: false, error: "Failed to send email" });

  return res.status(200).json({ ok: true, client_id, token, enlace });
}

// ------- FUNCIONES AUXILIARES ABAJO --------

async function upsertClient(email, order, url, apiKey) {
  const res = await fetch(`${url}/rest/v1/clients`, {
    method: "POST",
    headers: {
      "apikey": apiKey,
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates, return=representation"
    },
    body: JSON.stringify({
      email,
      name: [
        (order.customer && order.customer.first_name) || "",
        (order.customer && order.customer.last_name) || ""
      ].join(" ").trim(),
      shopify_customer_id: order.customer && order.customer.id
    })
  });
  const body = await res.json();
  return body[0] || {};
}

async function createWidget(client_id, url, apiKey) {
  const res = await fetch(`${url}/rest/v1/widgets`, {
    method: "POST",
    headers: {
      "apikey": apiKey,
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    },
    body: JSON.stringify({ client_id })
  });
  const body = await res.json();
  return body[0] ? body[0].id : undefined;
}

function randomToken(length = 16) {
  return crypto.randomBytes(length).toString("hex");
}

async function createMagicLink(client_id, widget_id, url, apiKey) {
  const token = randomToken();
  const res = await fetch(`${url}/rest/v1/magic_links`, {
    method: "POST",
    headers: {
      "apikey": apiKey,
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    },
    body: JSON.stringify({
      client_id,
      widget_id,
      token,
      created_at: new Date().toISOString()
    })
  });
  const body = await res.json();
  return body[0] ? body[0].token : undefined;
}

async function sendResendEmail(email, enlace, apiKey, from) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Tu acceso a Instagram Grid - Flujo Creativo",
      html: `
        <p>Hola, aquí tienes tu enlace de acceso:</p>
        <p><a href="${enlace}" style="background:#18181B;color:white;padding:12px 28px;text-decoration:none;border-radius:4px;font-family:inherit;display:inline-block">Abrir mi cuenta</a></p>
        <p>O copia este link:<br/><code>${enlace}</code></p>
        <p>¿Necesitas ayuda? Responde a este email.</p>`
    })
  });
  return res.ok;
}
