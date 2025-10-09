export const config = { runtime: 'nodejs20.x' };

export default async function handler(req, res) {
  const need = [
    'NOTION_TOKEN',
    'NOTION_DATABASE_ID',
    'FROM_EMAIL',
    'RESEND_API_KEY',
    // opcionales si luego usamos Supabase:
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY'
  ];
  const missing = need.filter(k => !process.env[k]);
  res.status(200).json({
    ok: true,
    node: process.version,
    missingEnv: missing
  });
}
