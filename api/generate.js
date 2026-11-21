import { createHash } from "node:crypto";
import { db } from "./_lib.js";
const E = process.env, MODEL = E.GEMINI_MODEL || "gemini-4-carbon";
const FOCUS = {
  kosakata: "Huruf dan Kosakata: cara baca kanji, kata yang tepat untuk melengkapi kalimat, hiragana/katakana.",
  percakapan: "Percakapan dan Ungkapan: respons yang tepat dalam situasi sehari-hari (toko, stasiun, tempat kerja, rumah sakit).",
  bacaan: "Pemahaman Bacaan: teks pendek (pengumuman, email, jadwal, pesan) di passage_ja, lalu satu pertanyaan tentang isinya."
};
async function gemini(prompt) {
  for (const think of [E.GEMINI_THINKING || "medium", null]) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": E.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", ...(think ? { thinkingConfig: { thinkingLevel: think } } : {}) } })
    });
    if (r.ok) { const j = await r.json(); return JSON.parse(j.candidates[0].content.parts.map(p => p.text || "").join("").replace(/```json|```/g, "")); }
    if (r.status !== 400 || !think) throw new Error(await r.text());
  }
}
const s = (v, n) => String(v ?? "").slice(0, n);
const valid = q => q && typeof q.stem_ja === "string" && Array.isArray(q.options) && q.options.length === 4 &&
  q.options.every(o => o && typeof o.ja === "string") && Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3;

export default async function handler(req, res) {
  try {
    const b = req.body || {};
    if (!E.ADMIN_PASSWORD || b.password !== E.ADMIN_PASSWORD) return res.status(401).json({ error: "Password admin salah atau ADMIN_PASSWORD belum diisi di Vercel." });
    if (!FOCUS[b.section]) return res.status(400).json({ error: "Bagian tidak valid." });
    if (b.step === "gen") {
      const n = Math.min(+b.count || 5, 8);
      const items = (await gemini(`Buat ${n} soal pilihan ganda orisinal bergaya JFT-Basic (level A2, penutur Indonesia) untuk bagian "${FOCUS[b.section]}"
Aturan: jangan menyalin soal ujian resmi; tepat satu jawaban benar; tiga pengecoh masuk akal; bahasa Jepang alami; variasikan topik.
Balas HANYA JSON array berisi objek: {"stem_ja":"...","stem_id":"terjemahan Indonesia soal","passage_ja":"${b.section === "bacaan" ? "teks bacaan" : ""}","options":[{"ja":"...","id":"terjemahan Indonesia"} x4],"answer":0-3,"explanation_id":"pembahasan singkat bahasa Indonesia"}`)).filter(valid);
      return res.json({ items });
    }
    if (b.step === "save") {
      const items = (b.items || []).filter(valid).slice(0, 8);
      if (!items.length) return res.status(400).json({ error: "Tidak ada soal valid." });
      const blind = items.map((q, i) => ({ i, passage_ja: q.passage_ja, stem_ja: q.stem_ja, options: q.options.map(o => o.ja) }));
      const solved = await gemini(`Jawab tiap soal bahasa Jepang ini secara mandiri. Balas HANYA JSON array: [{"i":nomor,"answer":0-3,"ambiguous":true/false}]\n${JSON.stringify(blind)}`);
      const ok = new Map(solved.map(x => [x.i, x]));
      const rows = items.map((q, i) => ({ section: b.section, stem_ja: s(q.stem_ja, 500), stem_id: s(q.stem_id, 500), passage_ja: q.passage_ja ? s(q.passage_ja, 1500) : null,
        options: q.options.map(o => ({ ja: s(o.ja, 200), id: s(o.id, 200) })), answer: q.answer, explanation_id: s(q.explanation_id, 800),
        status: ok.get(i)?.answer === q.answer && !ok.get(i)?.ambiguous ? "verified" : "draft",
        hash: createHash("sha1").update(q.stem_ja + (q.passage_ja || "")).digest("hex") }));
      await db("questions?on_conflict=hash", { method: "POST", headers: { Prefer: "return=minimal,resolution=ignore-duplicates" }, body: JSON.stringify(rows) });
      return res.json({ verified: rows.filter(r => r.status === "verified").length, draft: rows.filter(r => r.status === "draft").length });
    }
    res.status(400).json({ error: "Step tidak valid." });
  } catch (e) { res.status(500).json({ error: e.message }); }
}
