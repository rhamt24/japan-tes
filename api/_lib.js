const U = process.env.SUPABASE_URL, K = process.env.SUPABASE_SERVICE_KEY;
export const db = async (path, init = {}) => {
  const r = await fetch(`${U}/rest/v1/${path}`, { ...init, headers: { apikey: K, Authorization: `Bearer ${K}`, "content-type": "application/json", ...init.headers } });
  if (!r.ok) throw new Error(await r.text());
  return r.status === 204 ? null : r.json();
};
// Jumlah soal per bagian. Bagian tanpa soal terverifikasi dilewati.
export const QUOTA = { kosakata: 18, percakapan: 16, bacaan: 16, mendengarkan: 10 };
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
