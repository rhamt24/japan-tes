import { db, UUID } from "./_lib.js";
// POST /api/grade  {answers:[{id, choice}]}  -> nilai + pembahasan (kunci dicek di server)
export default async function handler(req, res) {
  try {
    const a = (req.body?.answers || []).filter(x => UUID.test(x.id));
    if (!a.length) return res.status(400).json({ error: "Tidak ada jawaban." });
    const rows = await db(`questions?select=id,section,stem_ja,answer,options,explanation_id&id=in.(${a.map(x => x.id).join(",")})`);
    const map = Object.fromEntries(rows.map(r => [r.id, r]));
    const review = a.map(x => {
      const q = map[x.id]; if (!q) return null;
      return { id: q.id, section: q.section, stem_ja: q.stem_ja, options: q.options, answer: q.answer, chosen: x.choice, right: x.choice === q.answer, explanation: q.explanation_id };
    }).filter(Boolean);
    const correct = review.filter(r => r.right).length;
    res.json({ total: review.length, correct, scaled: Math.round(correct / review.length * 250), review });
  } catch (e) { res.status(500).json({ error: e.message }); }
}
