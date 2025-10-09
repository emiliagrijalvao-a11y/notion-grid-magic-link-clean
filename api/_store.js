// api/_store.js
// Almacenamiento en memoria (dura mientras la función se mantiene caliente)
const MEM = globalThis.__MEM__ || { tokens: {} };
globalThis.__MEM__ = MEM;

export function saveClient(record) {
  MEM.tokens[record.magic_token] = record;
}

export function getClientByToken(token) {
  return MEM.tokens[token] || null;
}

export function touchToken(token) {
  const rec = MEM.tokens[token];
  if (rec) rec.last_accessed = new Date().toISOString();
  return rec || null;
}
