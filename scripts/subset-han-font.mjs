// Builds src/fonts/wenkai-subset.woff2: LXGW WenKai containing only the Chinese
// characters the site actually uses. Run `npm run fonts` after adding Chinese text.
//
// It scans src/ for CJK characters, asks Google Fonts for a subset with exactly
// those glyphs, and saves the result so next/font/local can self-host it.
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const srcDir = join(root, "src");
const outDir = join(srcDir, "fonts");
const FAMILY = "LXGW WenKai TC";
const SCAN_EXT = new Set([".ts", ".tsx", ".css", ".md", ".mdx", ".json", ".txt"]);
// CJK ideographs, CJK punctuation, full-width forms.
const HAN = /[　-〿㐀-䶿一-鿿＀-￯]/g;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (SCAN_EXT.has(extname(entry.name))) yield path;
  }
}

const chars = new Set();
for await (const file of walk(srcDir)) {
  if (file.endsWith("strokes.json")) {
    // Stroke data is keyed by character; include the keys only.
    for (const key of Object.keys(JSON.parse(await readFile(file, "utf8")))) chars.add(key);
    continue;
  }
  const text = await readFile(file, "utf8");
  for (const match of text.matchAll(HAN)) chars.add(match[0]);
}

const list = [...chars].sort();
if (list.length === 0) {
  console.error("No Chinese characters found in src/. Nothing to do.");
  process.exit(1);
}

const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(FAMILY)}&text=${encodeURIComponent(list.join(""))}`;
const css = await (await fetch(cssUrl, { headers: { "User-Agent": UA } })).text();
const fontUrl = css.match(/src:\s*url\((https:\/\/[^)]+)\)\s*format\('woff2'\)/)?.[1];
if (!fontUrl) {
  console.error("Google Fonts did not return a woff2 subset. Response was:\n" + css);
  process.exit(1);
}

const font = Buffer.from(await (await fetch(fontUrl)).arrayBuffer());
await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, "wenkai-subset.woff2"), font);
await writeFile(join(outDir, "wenkai-subset.txt"), list.join("") + "\n", "utf8");
console.log(`wenkai-subset.woff2: ${list.length} characters, ${font.length} bytes`);
