async function gemini(prompt) {
  const models = [MODEL, E.GEMINI_FALLBACK_MODEL].filter(Boolean);
  let last = "", status = 0;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      for (const think of [E.GEMINI_THINKING || "medium", null]) {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": E.GEMINI_API_KEY },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", ...(think ? { thinkingConfig: { thinkingLevel: think } } : {}) } })
        });
        if (r.ok) { const j = await r.json(); return JSON.parse(j.candidates[0].content.parts.map(p => p.text || "").join("").replace(/```json|```/g, "")); }
        status = r.status; last = await r.text();
        if (status === 400 && think) continue;
        break;
      }
      if (status !== 503 && status !== 429) throw new Error(last);
      await new Promise(x => setTimeout(x, 3000));
    }
  }
  throw new Error(last);
}
