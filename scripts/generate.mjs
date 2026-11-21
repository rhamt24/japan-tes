// Generate soal pakai Gemini -> verifikasi (jawab buta) -> simpan ke Supabase.
// Pakai: npm run generate -- kosakata 5   (5 batch x 10 soal)
import { createHash } from "node:crypto";
const [section = "kosakata", batches = "1"] = process.argv.slice(2);
const E = process.env, MODEL = E.GEMINI_MODEL || "gemini-4-carbon";

const FOCUS = {
  kosakata: "Huruf dan Kosakata: cara baca kanji, kata yang tepat untuk melengkapi kalimat, hiragana/katakana.",
  percakapan: "Percakapan dan Ungkapan: respons yang tepat dalam situasi sehari-hari (toko, stasiun, tempat kerja, rumah sakit).",
  bacaan: "Pemahaman Bacaan: teks pendek (pengumuman, email, jadwal, pesan) di passage_ja, lalu satu pertanyaan tentang isinya."
}[section];
if (!FOCUS) throw new Error("Bagian: kosakata | percakapan | bacaan (mendengarkan butuh audio, tahap 2)");

async function gemini(prompt) {
  for (const think of [E.GEMINI_THINKING || "high", null]) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": E.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", ...(think ? { thinkingConfig: { thinkingLevel: think } } : {}) } })
    });
    if (r.ok) { const j = await r.json(); return JSON.parse(j.candidates[0].content.parts.map(p => p.text || "").join("").replace(/```json|```/g, "")); }
    if (r.status !== 400 || !think) throw new Error(await r.text()); // 400 -> coba ulang tanpa thinkingConfig
  }
}

const genPrompt = `Buat 10 soal pilihan ganda orisinal bergaya JFT-Basic (level A2, penutur Indonesia) untuk bagian "${FOCUS}"
Aturan: jangan menyalin soal ujian resmi; tepat satu jawaban benar; tiga pengecoh masuk akal; bahasa Jepang alami; variasikan topik.
Balas HANYA JSON array berisi objek: {"stem_ja":"...","stem_id":"terjemahan Indonesia soal","passage_ja":"${section === "bacaan" ? "teks bacaan" : ""}","options":[{"ja":"...","id":"terjemahan Indonesia"} x4],"answer":0-3,"explanation_id":"pembahasan singkat bahasa Indonesia"}`;

async function sb(items) {
  const r = await fetch(`${E.SUPABASE_URL}/rest/v1/questions?on_conflict=hash`, { method: "POST",
    headers: { apikey: E.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${E.SUPABASE_SERVICE_KEY}`, "content-type": "application/json", Prefer: "resolution=ignore-duplicates" },
    body: JSON.stringify(items) });
  if (!r.ok) throw new Error(await r.text());
}

for (let b = 0; b < +batches; b++) {
  const items = (await gemini(genPrompt)).filter(q => q.options?.length === 4 && q.answer >= 0 && q.answer <= 3);
  // Verifikasi: model menjawab tanpa melihat kunci; hanya yang cocok jadi "verified"
  const blind = items.map((q, i) => ({ i, passage_ja: q.passage_ja, stem_ja: q.stem_ja, options: q.options.map(o => o.ja) }));
  const solved = await gemini(`Jawab tiap soal bahasa Jepang ini secara mandiri. Balas HANYA JSON array: [{"i":nomor,"answer":0-3,"ambiguous":true/false}]\n${JSON.stringify(blind)}`);
  const ok = new Map(solved.map(s => [s.i, s]));
  const rows = items.map((q, i) => ({ section, stem_ja: q.stem_ja, stem_id: q.stem_id, passage_ja: q.passage_ja || null,
    options: q.options, answer: q.answer, explanation_id: q.explanation_id,
    status: ok.get(i)?.answer === q.answer && !ok.get(i)?.ambiguous ? "verified" : "draft",
    hash: createHash("sha1").update(q.stem_ja + (q.passage_ja || "")).digest("hex") }));
  await sb(rows);
  console.log(`Batch ${b + 1}: ${rows.filter(r => r.status === "verified").length} verified, ${rows.filter(r => r.status === "draft").length} draft`);
}
