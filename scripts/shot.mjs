// Screenshot helper for checking pages by eye. Drives the installed Chrome.
//
//   node scripts/shot.mjs <path> <out.png> [options]
//
//   --w 1280          viewport width (default 1280)
//   --h 800           viewport height (default 800)
//   --full            capture the whole page, not just the viewport
//   --mode dark       force a colour mode: light | dark | now
//   --reduce          emulate prefers-reduced-motion
//   --wait 800        extra milliseconds to wait before the shot (default 600)
//   --scroll 1200     scroll to this y first; or --scroll "#id" to bring an element into view
//   --hover "sel"     hover an element before the shot
//   --click "sel"     click an element before the shot
//   --focus "sel"     focus an element before the shot
//   --type "sel=text" type text into an element (repeatable)
//   --eval "js"       run JavaScript in the page before the shot
//   --errors          print console errors and failed requests
//   --base http://localhost:3000
//
// Example: node scripts/shot.mjs /preview/chart shots/chart.png --full --mode dark
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import puppeteer from "puppeteer-core";

const args = process.argv.slice(2);
const [rawPath, out] = args;
if (rawPath === undefined || !out) {
  console.error("usage: node scripts/shot.mjs <path> <out.png> [options]");
  process.exit(1);
}
// Git Bash on Windows rewrites a leading "/" into "C:/Program Files/Git/...".
// Undo that, and accept paths written without the slash ("preview/chart", "home").
let path = rawPath.replace(/^[A-Za-z]:[\\/].*?[\\/]Git[\\/]?/, "/");
if (path === "home" || path === ".") path = "/";
if (!path.startsWith("/") && !path.startsWith("http")) path = "/" + path;
const flag = (name) => args.includes(`--${name}`);
const value = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};
const values = (name) => args.flatMap((a, i) => (a === `--${name}` && args[i + 1] !== undefined ? [args[i + 1]] : []));

const chromePaths = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);
const executablePath = chromePaths.find((p) => existsSync(p));
if (!executablePath) {
  console.error("Chrome not found. Set CHROME_PATH.");
  process.exit(1);
}

const base = value("base", "http://localhost:3000");
const width = Number(value("w", 1280));
const height = Number(value("h", 800));
const mode = value("mode", null);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--hide-scrollbars"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: Number(value("dpr", 1)) });
  if (flag("reduce")) await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  if (mode) {
    await page.evaluateOnNewDocument((m) => {
      try {
        localStorage.setItem("mode", m);
      } catch {}
    }, mode);
  }
  const problems = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") problems.push(`console: ${msg.text()}`);
  });
  page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));
  page.on("requestfailed", (req) => problems.push(`failed: ${req.url()} ${req.failure()?.errorText ?? ""}`));

  await page.goto(path.startsWith("http") ? path : base + path, { waitUntil: "networkidle2", timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);

  const scroll = value("scroll", null);
  if (scroll !== null) {
    if (/^\d+$/.test(scroll)) await page.evaluate((y) => window.scrollTo(0, y), Number(scroll));
    else await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: "start" }), scroll);
    await sleep(400);
  }
  for (const pair of values("type")) {
    const i = pair.indexOf("=");
    await page.type(pair.slice(0, i), pair.slice(i + 1));
  }
  const js = value("eval", null);
  if (js) await page.evaluate(js);
  const click = value("click", null);
  if (click) await page.click(click);
  const focus = value("focus", null);
  if (focus) await page.focus(focus);
  const hover = value("hover", null);
  if (hover) await page.hover(hover);

  await sleep(Number(value("wait", 600)));
  mkdirSync(dirname(out), { recursive: true });
  await page.screenshot({ path: out, fullPage: flag("full") });
  const size = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    height: document.documentElement.scrollHeight,
  }));
  console.log(`saved ${out} (${width}x${flag("full") ? size.height : height})`);
  if (size.scrollWidth > size.clientWidth) console.log(`WARNING: page scrolls sideways (${size.scrollWidth} > ${size.clientWidth})`);
  if (flag("errors") || problems.length) console.log(problems.length ? problems.join("\n") : "no console errors");
} finally {
  await browser.close();
}
