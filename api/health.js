export const config = { runtime: 'nodejs' }; // runtime soportado

export default async function handler(req, res) {
  const need = ['NOTION_TOKEN', 'NOTION_DATABASE_ID'];
  const missing = need.filter((k) => !process.env[k]);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    ok: missing.length === 0,
    node: process.version,
    missingEnv: missing,
    timestamp: new Date().toISOString(),
  });
}
