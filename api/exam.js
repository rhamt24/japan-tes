import { db, QUOTA, shuffle } from "./_lib.js";
// GET /api/exam -> soal acak (tanpa kunci jawaban). Urutan pilihan juga diacak.
export default async function handler(req, res) {
  try {
    const out = [];
    for (const [sec, n] of Object.entries(QUOTA)) {
      const audio = sec === "mendengarkan" ? "&audio_url=not.is.null" : "";
      const ids = await db(`questions?select=id&section=eq.${sec}&status=eq.verified${audio}&limit=5000`);
      const pick = shuffle(ids).slice(0, n).map(x => x.id);
      if (!pick.length) continue;
      const rows = await db(`questions?select=id,section,stem_ja,stem_id,passage_ja,options,image_url,audio_url&id=in.(${pick.join(",")})`);
      out.push(...shuffle(rows));
    }
    res.setHeader("Cache-Control", "no-store");
    res.json(out.map(q => ({ ...q, options: shuffle(q.options.map((o, i) => ({ i, ja: o.ja, id: o.id }))) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
}
