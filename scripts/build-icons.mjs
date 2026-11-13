// Generates the site's icons and share image from the seal's stroke data:
//
//   src/app/icon.svg             browser tab icon (the seal)
//   src/app/apple-icon.png       home-screen icon, 180px
//   src/app/favicon.ico          legacy tab icon, 48px
//   src/app/opengraph-image.png  1200x630 share image, a screenshot of the opening at rest
//
// Run `npm run icons`. The share image needs the dev server on localhost:3000;
// pass --no-og to skip it.
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const app = join(root, "src", "app");
const strokes = JSON.parse(await readFile(join(root, "src", "lib", "hanzi", "strokes.json"), "utf8"));

const CINNABAR = "#C23B22";
const CARVED = "#F7F8F6";
const GRID = [
  ["扬", "付"],
  ["印", "优"],
];

function sealSvg({ radius }) {
  const SIZE = 100;
  const PAD = 9;
  const GAP = 3.5;
  const CELL = (SIZE - 2 * PAD - GAP) / 2;
  const GROW = 1.1;
  const K = (CELL * GROW) / 1024;
  const groups = GRID.flatMap((row, r) =>
    row.map((char, c) => {
      const x = PAD + c * (CELL + GAP) - (CELL * (GROW - 1)) / 2;
      const y = PAD + r * (CELL + GAP) - (CELL * (GROW - 1)) / 2;
      const paths = strokes[char].strokes.map((d) => `<path d="${d}"/>`).join("");
      return `<g transform="translate(${x.toFixed(3)} ${(y + 900 * K).toFixed(3)}) scale(${K.toFixed(5)} ${(-K).toFixed(5)})">${paths}</g>`;
    }),
  );
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">` +
    `<rect width="${SIZE}" height="${SIZE}" rx="${radius}" fill="${CINNABAR}"/>` +
    `<g fill="${CARVED}" stroke="${CARVED}" stroke-width="34" stroke-linejoin="round">${groups.join("")}</g>` +
    `</svg>\n`
  );
}

const chromePaths = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);
const executablePath = chromePaths.find((p) => existsSync(p));
if (!executablePath) {
  console.error("Chrome not found. Set CHROME_PATH.");
  process.exit(1);
}

await writeFile(join(app, "icon.svg"), sealSvg({ radius: 6 }), "utf8");
console.log("icon.svg");

const browser = await puppeteer.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage();
  const renderPng = async (size, radius) => {
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await page.setContent(
      `<!doctype html><html><body style="margin:0;background:transparent">${sealSvg({ radius }).replace("<svg ", `<svg width="${size}" height="${size}" style="display:block" `)}</body></html>`,
    );
    return page.screenshot({ type: "png", omitBackground: true });
  };

  // Apple masks the corners itself, so this one is full-bleed.
  await writeFile(join(app, "apple-icon.png"), await renderPng(180, 0));
  console.log("apple-icon.png");

  // An .ico file may simply wrap a PNG: 6-byte header, one 16-byte entry, then the image.
  const png = await renderPng(48, 3);
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image
  header.writeUInt8(48, 6); // width
  header.writeUInt8(48, 7); // height
  header.writeUInt8(0, 8);
  header.writeUInt8(0, 9);
  header.writeUInt16LE(1, 10); // colour planes
  header.writeUInt16LE(32, 12); // bits per pixel
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18); // offset of the image data
  await writeFile(join(app, "favicon.ico"), Buffer.concat([header, png]));
  console.log("favicon.ico");

  if (!process.argv.includes("--no-og")) {
    await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(() => {
      try {
        localStorage.setItem("mode", "light");
        localStorage.setItem("opening-seen", String(Date.now()));
      } catch {}
    });
    await page.goto("http://localhost:3000/", { waitUntil: "networkidle2", timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, 4500));
    await page.evaluate(() => {
      document.querySelector("header")?.remove();
      document.querySelector("nextjs-portal")?.remove();
      document.querySelectorAll("#top .opening-late[aria-hidden]").forEach((el) => el.remove());
    });
    await page.screenshot({ path: join(app, "opengraph-image.png"), clip: { x: 0, y: 0, width: 1200, height: 630 } });
    await writeFile(join(app, "opengraph-image.alt.txt"), "Frank Fu, written in small squares, beside a red name seal.\n", "utf8");
    console.log("opengraph-image.png");
  }
} finally {
  await browser.close();
}
