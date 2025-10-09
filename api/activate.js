// api/activate.js
export const config = { runtime: 'nodejs' };

import crypto from 'crypto';
import { saveClient } from './_store.js';

async function testNotionCreds(token, databaseId) {
  const r = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28'
    }
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Notion invalid: status=${r.status} body=${t.slice(0, 300)}`);
  }
}

export default async function handler(req, res) {
  // CORS + preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Método no permitido' });

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    if (!body || typeof body !== 'object') body = {};

    const email = String(body.email || '').trim().toLowerCase();
    const client_name = String(body.client_name || '').trim().toLowerCase().replace(/\s+/g, '');
    const notion_token = String(body.notion_token || '').trim();
    const database_id = String(body.database_id || '').trim().replace(/-/g, '');
    const bio_database_id = String((body.bio_database_id || '')).trim().replace(/-/g, '') || null;

    // Validaciones mínimas
    const errs = [];
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.push('email inválido');
    if (!client_name || !/^[a-z0-9_-]{3,32}$/.test(client_name)) errs.push('client_name inválido (a-z0-9_-, 3-32)');
    if (!notion_token || !notion_token.startsWith('secret_')) errs.push('notion_token inválido (debe iniciar con secret_)');
    if (!database_id || database_id.length < 32) errs.push('database_id inválido');

    if (errs.length) {
      return res.status(400).json({ ok: false, message: 'Errores de validación', errors: errs });
    }

    // Test directo a Notion (evita guardar credenciales malas)
    await testNotionCreds(notion_token, database_id);

    // Generar token
    const magic_token = crypto.randomBytes(32).toString('hex');

    // Guardar en memoria
    const record = {
      magic_token,
      email,
      client_name,
      notion_token,
      database_id,
      bio_database_id,
      created_at: new Date().toISOString(),
      last_accessed: null,
      is_active: true
    };
    saveClient(record);

    // Construir magic link absoluto
    const host = req.headers['x-forwarded-host'] || req.headers.host || '';
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const base = host ? `${proto}://${host}` : '';
    const magic_link = base ? `${base}/?token=${magic_token}` : `/?token=${magic_token}`;

    // (Opcional) enviar email si tienes RESEND_API_KEY y FROM_EMAIL
    // Desactivado en Fase A. Lo activamos en Fase B con Supabase.
    // if (process.env.RESEND_API_KEY && process.env.FROM_EMAIL) { ... }

    return res.status(200).json({
      ok: true,
      message: 'Widget activado (demo en memoria).',
      magic_link,
      token: magic_token,
      hint: 'Guarda este link. En Fase B será persistente con Supabase.'
    });

  } catch (e) {
    return res.status(500).json({ ok: false, message: 'Error en activación', error: String(e?.message || e) });
  }
}
