// Membuat public/words.json dari JMdict (versi jmdict-simplified, kata umum saja).
// Jalankan sekali di komputermu: npm run build:data
// Butuh Node 18+ dan perintah `tar` (ada di Linux/macOS/Windows 10+).
import { writeFile, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { execSync } from "node:child_process";

const LIMIT = 6000; // jumlah kata maksimal di words.json
const API = "https://api.github.com/repos/scriptin/jmdict-simplified/releases/latest";
const tmp = "./.tmp-jmdict";

const rel = await (await fetch(API, { headers: { "User-Agent": "tes-jepang" } })).json();
const asset = rel.assets.find(a => /^jmdict-eng-common-.*\.json\.tgz$/.test(a.name));
if (!asset) throw new Error("File jmdict-eng-common tidak ditemukan di release terbaru.");

console.log("Mengunduh", asset.name);
await rm(tmp, { recursive: true, force: true });
await mkdir(tmp, { recursive: true });
const buf = Buffer.from(await (await fetch(asset.browser_download_url)).arrayBuffer());
await writeFile(`${tmp}/jmdict.tgz`, buf);
execSync(`tar -xzf jmdict.tgz`, { cwd: tmp });

const jsonFile = (await readdir(tmp)).find(f => f.endsWith(".json"));
const data = JSON.parse(await readFile(`${tmp}/${jsonFile}`, "utf8"));

const words = [];
for (const w of data.words) {
  const k = w.kanji?.[0]?.text, r = w.kana?.[0]?.text, s = w.sense?.[0];
  if (!k || !r || !s) continue;
  if (k.length > 4) continue;
  const m = s.gloss.filter(g => g.lang === "eng").map(g => g.text).slice(0, 2).join("; ");
  if (!m || m.length > 40) continue;
  words.push({ k, r, m, p: s.partOfSpeech?.[0] ?? "" });
  if (words.length >= LIMIT) break;
}

await writeFile("./public/words.json", JSON.stringify(words));
await rm(tmp, { recursive: true, force: true });
console.log(`Selesai: ${words.length} kata ditulis ke public/words.json`);
