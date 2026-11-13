# youyangfu.com build spec

The single source of truth for building Frank Fu's personal site. Read this before writing code. The visual version, with a wireframe for every chapter, is the blueprint page: https://claude.ai/artifact/DJ1Di8dxx6XmJkBitq53Jm (private to the owner).

- Status: phase 1 built (2026-11-13). See section 9 for what is done and what is left.
- How to work in the codebase: [`docs/building-chapters.md`](building-chapters.md). Wireframes: [`docs/blueprint-wireframes.html`](blueprint-wireframes.html).
- Reference implementation of the opening: [`docs/prototypes/opening-sequence.html`](prototypes/opening-sequence.html). Port its logic; don't reinvent it.
- This repo uses Next.js 16. Per `AGENTS.md`, read the relevant guide in `node_modules/next/dist/docs/` before writing code. `next.config.ts` already enables `cacheComponents` and `partialPrefetching`.

---

## 1. The owner (facts the site uses)

| | |
|---|---|
| Name shown everywhere | **Frank Fu** |
| Legal name (search metadata) | Youyang Fu |
| Chinese name | 付优扬, pinyin Fù Yōuyáng (tones 4, 1, 2) |
| Study | Bachelor of Engineering (Honours), Software Engineering, University of Auckland. Started 2024, expected to finish end of 2027. |
| Hometown | Zhengzhou 郑州, Henan, China. 34.7466°N, 113.6253°E |
| Grew up | Hamilton, New Zealand, from July 2016 to February 2024 |
| Home | Auckland, New Zealand, since March 2024 (moved for university). 36.8485°S, 174.7633°E |
| Born | March 2006 in Zhengzhou (exact day held back from the repo until the owner decides whether to publish it) |
| Arrived in NZ | July 2016, age 10 (exact day unknown) |
| Domain | youyangfu.com |
| Interests | Badminton (Victor gear), Texas Hold'em, gaming, trading |
| GitHub, LinkedIn | Pending. Use placeholders. |

**Never write the year of study by hand.** Derive it from the 2024 start: the year of study increments on 1 March each year, and after 2027 the copy switches to graduate wording. The opening line doesn't mention a year at all.

**The owner's email address never appears in code or content.** The contact form reads it from `CONTACT_TO_EMAIL` (see section 8).

Useful derived facts:
- Zhengzhou to Auckland great-circle distance: **10,163 km**.
- Time difference: Auckland is 5 h ahead of China in NZ summer (NZDT), 4 h in NZ winter (NZST). Use IANA zones `Pacific/Auckland` and `Asia/Shanghai`.
- Crossover (time in NZ exceeds time in China) happens between 2026-10-06 and 2026-12-05 depending on the arrival day. Until the day is known, assume 15 July 2016 and label it approximate.
- 付优扬 has 17 strokes: 付 5, 优 6, 扬 6.

---

## 2. Concept and principles

Chinese characters are 方块字, square block characters, learned inside the squares of 田字格 practice paper. **Everything on the site is built from one material: small squares on one shared lattice**, which assemble into the name, the map, the chart and the avatar.

1. **One material.** Everything that moves is squares on the same lattice. Text stays real HTML text.
2. **A quiet page with three loud moments:** the opening, the flight to Auckland, the life chart. Everything else is still, typographic and precise.
3. **The visitor drives motion.** Scroll plays scenes; the cursor plays details. Only the opening and live data (clocks, the forming candle, the life-split counter) move on their own.
4. **Two scripts as equals.** Chinese appears where it carries meaning: the name, places, chapter numerals. Never as decoration.
5. **Fast and kind.** Every scene has a still version for slow devices and reduced motion. Nothing important hides behind an animation.

Chapter numerals use 大写 financial numerals 壹 贰 叁 肆 伍 陆 (the forms written on cheques so amounts can't be altered; the surname 付 means "to pay").

---

## 3. Site map

### Routes

| Route | Purpose | Phase |
|---|---|---|
| `/` | The story: opening plus six chapters | 1 |
| `/work/[slug]` | Project case study | 1 template, 3 content |
| `/Frank-Fu-CV.pdf` | The CV itself, linked as "CV" in the menu, footer, Work and Let's connect. `/resume` redirects here. There is no resume page: the owner chose to keep detail in the PDF (2026-11-13). | 1 |
| `/play/court`, `/play/table`, `/play/arcade` | Full personal rooms | 4 |
| 404 (`not-found.tsx`) | 不中 (Henan dialect for "no good"), link home; rally game later | 1 plain, 5 game |

### Home page order

| # | Chapter | Anchor | Scroll length | Notes |
|---|---|---|---|---|
| | Opening | `#top` | 1 screen | |
| 壹 | Two homes | `#two-homes` | 3 screens, pinned | Nav label "About" points here and stays lit through The chart |
| 贰 | The chart | `#chart` | 3 screens, pinned | |
| 叁 | Work | `#work` | 1.5 screens | |
| 肆 | Stack | `#stack` | 1 screen | |
| 伍 | Off the clock | `#play` | 3 screens, pinned, horizontal | |
| 陆 | Let's connect | `#connect` | 1 screen | |
| | Footer | | half | |

Pinned scenes are phase 2. In phase 1 each chapter renders as a normal-height section with its final layout.

---

## 4. On every page

- **Sections assemble as you scroll.** Pieces marked `data-assemble` (or the children of `data-assemble-items`) travel in from an offset and settle while their top rises through the lower part of the screen, scrubbed by scroll with CSS scroll-driven animations (`globals.css`). Chapter headings do this automatically: the numeral drops in and the title's words converge. Without support, or with reduced motion, the finished layout shows.

- **Header.** Seal (links home, 28px) and "Frank Fu" on the left; About, Work, Play, Contact, CV on the right (page order, so the underline moves left to right as you scroll); mode switch at the far right. The current chapter's link gets a 1.5px cinnabar underline. Hides on scroll down, returns on scroll up. On phones: a menu button opening a full-screen list.
- **Mode switch.** One small square that cycles Light → Dark → Now. **Now is the default**: the palette follows the sun's elevation over Auckland. The mode is applied by an inline script in `<head>` before first paint, so the page never flashes the wrong theme. Persist the choice in `localStorage`.
- **Hold'em progress** (phase 2). Bottom-right corner. Visitor is dealt two face-down cards at the opening; flop turns at 贰, turn at 肆, river at 伍, showdown at 陆. Each revealed card carries a fact on hover. Doubles as the scroll progress indicator.
- **Page transition.** Squares sweep out from the click point, the route changes underneath, squares clear. Built as an overlay canvas in `PageWipe.tsx`; internal links use `TransitionLink`. Reduced motion navigates plainly.
- **Cursor.** Native cursor. Squares near the pointer grow slightly (prototype's `proximity()`), desktop only.
- **Sound.** Only on explicit action (tapping the pinyin plays the name recording).

---

## 5. Chapters

### Opening
- **See:** faint 米字格 grids; 付优扬 writes itself in true stroke order as squares, with a cinnabar wet tip that dries to ink; pinyin with Chao tone contours (fù 51, yōu 55, yáng 35); squares fly into "Frank Fu"; the 2×2 seal 付优扬印 stamps (read right column first: 付优 / 扬印). Then one line: **"Software engineering student at the University of Auckland. Born in Zhengzhou, raised in Auckland."**
- **Moves:** about 6 s on first visit; scrolling or clicking skips to the end. Repeat visit within 24 h: a 1.5 s version. Hover or tap the name to switch scripts. Phase 2: hovering a character splits it into components (付 = 亻 person + 寸 hand; 优 = 亻 person + 尤 outstanding; 扬 = 扌 hand + 昜 sun rising); tapping pinyin plays the recording.
- **Phase 1 acceptance:** prototype behaviour ported to the squares engine, timings matching the prototype (flight 720ms, spread 0.3).

### 壹 Two homes
- **See:** a map made of squares. Zhengzhou lights up and its 米-shaped high-speed rail lines draw outward. The view pulls back; an arc flies 10,163 km to Auckland while the clock jumps forward; then the life split: Zhengzhou ~10.3 years (fixed, cinnabar) | Auckland (ink, growing live).
- **Moves:** scroll scrubs four steps (Zhengzhou, the flight, Auckland, the split). "Flip the world" mirrors the map across the equator (34.7°N lands near 36.8°S). Live counter: "% of my life in Aotearoa" to 6 decimals.
- **Phase 1:** static two-column layout (map frame with both points and the arc, facts, live split bar and counter). Scene in phase 2.
- **Content needed:** a short paragraph on growing up between the two.

### 贰 The chart
- **See:** life as a dense market chart, one candle per month from March 2006 to the current month, with no gaps. Green when a month closed higher than it opened, red when lower, throughout. No prices or price axis.
- **Real versus generated:** only the periods (Zhengzhou, Hamilton, Auckland) and events in `src/content/timeline.ts` are real, and only facts the owner has stated go there. The movement between events is a seeded random walk (`chart/series.ts`): stable per month, re-forming as events are added. Events can `lift` the line, `shake` it for a few months, and carry a `flag`.
- **Listings:** the China years trade as 付优扬 on the **SSE** (Shanghai Stock Exchange); from the move, as **FRK** on the **NZX**. Both are stock exchanges, so the comparison holds.
- **Dynamic:** the chart is drawn in the browser up to the current month; the latest candle is dashed and grows through the month. Candles group into 2, 3, 6 or 12 months when the screen is too narrow for monthly ones.
- **Interaction:** hover or tap snaps a crosshair to a candle and shows a card with the period, the place, and any real events in it. Keyboard: arrows, Page Up/Down (a year), Home/End, Escape. Flags under the axis are laid out by a small solver so no label touches another or crosses a stem.
- **Always:** a Chart/List switch; List shows each place with its real events as plain text, in the page from the start.
- **Phase 2:** draw the candles on scroll, and zoom.

### 叁 Work
- **See:** an index list: Project, Year, Role, Stack, Status. First row: "WEB3 UoA", 2026, Project manager and developer, React, Next.js and PostgreSQL, Live.
- **Moves:** hovered row lifts; a preview image follows the cursor, assembling from squares. Click opens `/work/[slug]` with the square wipe.
- **Case study page:** title, facts row (year, role, stack, links), hero image, sections (The problem, What I built, Decisions, Outcome), next project link.

### 肆 Stack
- **See:** the owner's tools as casino plaques (rectangular chips) stacked in five towers, one per area, inside a bounded play region.
- **Moves:** every plaque is a rigid body (matter-js, loaded lazily). Visitors pick blocks up, drag and throw them; all blocks collide. Reset flies each one home on an arc (about 800ms, staggered). Before the first grab, blocks follow scroll: scattered above the region, assembling into the towers as the section rises. Phones: three towers on a shelf, two on the floor.
- **Code:** `stack/PlayTable.tsx` (layout, server-rendered home state), `stack/stack-play.ts` (physics), `stack/ToolList.tsx` (screen-reader list).

### 伍 Off the clock
- **Now:** two rooms. **Court 球场**: the player as a hologram built from cubes, turning slowly on a round projector floor (three.js, loaded when the room nears the screen, drawn only while on screen). Drag turns it a full 360°; arrow keys turn it 15° a step. Pointing at a piece of gear (racket, strings, grip, shoes, bag, top to bottom; the shirt is just part of the player) makes that piece materialise solid in its real colours, bottom cube first, while the rest steps back; a card pops out on the far side with the gear as colour-correct pixel art (drawn from product photos, never the photos themselves), its label and its name, joined to the piece by a cinnabar leader line. A row of chips under the stage does the same and turns the figure to face the piece. Phones: tap a piece; the card sits under the stage. Reduced motion: no idle turn, scan lines still, pieces appear whole. Gear in `content/play.ts`; figure in `play/hologram/figure-3d.ts`; scene in `play/hologram/hologram-scene.ts`; pixel art and tints in `play/gear-art.ts`. **Table 牌桌**: the owner's hand, 2♦ 7♦ (27, the birthday), with the board dealt a street at a time: flop 2♠ 6♦ A♦, turn 7♥, and a river that stays face down ("still early"). Each street has a one-line meaning, set in `content/play.ts`.
- **Only real content shows:** a piece of gear is pointable once it is listed, and the Arcade room returns once there are games to list.
- **Motion note:** the hologram is the one scene besides the opening that moves by itself (a slow idle turn, scan lines, a sweep every six seconds), and only while on screen and with motion allowed.

### 陆 Let's connect
- **See:** heading "Let's connect", one line ("Work, a badminton hit, or just hello."), links (GitHub, LinkedIn, Email, CV). The email address is the owner's choice to show; it is read from `CONTACT_TO_EMAIL` when the page is built, so it never sits in the repository. (The CV PDF also carries the owner's email and phone, by their choice.) Form: Name, Email, topic chips (Work, Just saying hi, Badminton hit, Something else) that become the subject, Message, Send.
- **Moves:** on success the message folds into a square, the seal stamps it, button reads "Sent". On failure, say what went wrong and keep the message. Under the button: Auckland's current time and an expected reply ("It's 9:40 pm in Auckland, so expect a reply tomorrow.").
- **Phase 1:** fully working (section 8).

### Footer
Seal; live clocks for Auckland and Zhengzhou; live life split; links; "© 2026 Frank Fu, 付优扬"; "Built with Next.js".

---

## 6. Design tokens

### Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#EDEFEC` | `#13161B` | Background |
| `--surface` | `#F7F8F6` | `#1A1E24` | Raised surfaces (cards, inputs) |
| `--ink` | `#1B1E24` | `#E7E9E4` | Text, squares |
| `--ink-soft` | `#5C636D` | `#979DA6` | Secondary text (darkened from the first draft to pass AA contrast on paper) |
| `--grid` | `#C3C8C8` | `#2C313A` | 米字格 lines, hairlines |
| `--line` | `#A7ADB1` | `#454C57` | Borders, controls |
| `--cinnabar` | `#C23B22` | `#E0563D` | The only accent: seal, wet stroke tip, focus, current nav item, ZCE up / NZX down |
| `--jade` | `#2B7A5F` | `#4FB08B` | Chart only: ZCE down / NZX up |

**Now mode:** `t = smoothstep(-7°, 3°, sunElevation)` blends paper from dark to light, plus a dusk tint near the horizon (`#E3B996` above -2°, `#46517C` below, weight `exp(-((el-1)/4.5)^2) × 0.14–0.2`). Choose the ink set by paper luminance (> 0.28 → light set). Derive grid/line/soft by mixing paper toward ink (0.16 / 0.32 / 0.62). Recompute every minute. The sun-position function is in the prototype (`sunElevation`).

### Type
- **Latin:** Instrument Sans 400/500/600 via `next/font/google`. Tight tracking at display sizes (-0.02em to -0.03em).
- **Chinese:** LXGW WenKai (霞鹜文楷, OFL), self-hosted via `next/font/local`, **subset to the characters the site uses**.
- **Numbers:** `font-variant-numeric: tabular-nums` wherever digits align.
- **Scale (px, desktop):** 76, 52, 36, 26, 20, 17 (body, line-height 1.6), 14, 12. Running text under about 68ch.
- Avoid: all-caps eyebrow labels, monospace data labels, middle-dot meta strings.

### Layout
- 12 columns, 24px gutters (16px under 640px), max width 1440px.
- Every size snaps to an 8px lattice; the squares engine uses the same lattice.
- Text left-aligned; the name and set pieces centred.
- Radius 2px on controls; no blanket card shadows.

### Motion

| Token | Curve | Use |
|---|---|---|
| `brush` | `cubic-bezier(.55, 0, .35, 1)` | Stroke writing |
| `flight` | `cubic-bezier(.7, 0, .2, 1)` | Squares leaving and landing, 720ms |
| `settle` | `cubic-bezier(.2, .8, .2, 1)` | Interface responses, 320ms |
| `out` | `cubic-bezier(.16, 1, .3, 1)` | Reveals, 600ms |

Hover feedback 160ms. Anything the visitor touches responds within 100ms. Scroll scenes are scrubbed, with no duration. Only the opening animates by itself. `prefers-reduced-motion`: scenes become still frames, transitions become 150ms fades, the opening shows its final state.

---

## 7. Architecture

- **Framework:** Next.js 16 App Router, React 19, TypeScript (`src/` layout).
- **Styling:** Tailwind CSS 4. Tokens defined once as CSS variables in `globals.css` and exposed through `@theme`.
- **Motion:** Lenis for smooth wheel scrolling (phase 1). GSAP + ScrollTrigger are installed but not loaded yet; sync them to Lenis when the first pinned scene is built in phase 2, so phase 1 ships no unused JavaScript. Motion for small interface animations.
- **Squares engine:** one canvas per scene, each inside its own section so it scrolls natively with the page (a single fixed canvas drifts against the text during touch scrolling). Phase 1 uses Canvas 2D: `src/components/squares/glyph-scene.ts` writes characters in stroke order, morphs them into a Latin word and stamps the seal; `OpeningStage` and `WrittenGlyphs` wrap it for React. Scenes pause off screen and stop their frame loop when at rest. Move to WebGL (three.js instancing) only for scenes that need tens of thousands of squares, such as the 3D avatar.
- **Content:** typed data in `src/content/`. Case studies are typed sections in `projects.ts` (MDX can be added later if long-form writing needs it). Layout code never hardcodes content.
- **Email:** Resend through a server action (to add `resend` and `zod`).
- **Hosting:** Vercel, domain youyangfu.com.

### Folder structure

```
src/
  app/
    layout.tsx            fonts, mode script, header, footer, squares canvas
    page.tsx              opening + six chapters
    work/[slug]/page.tsx  case study
    play/[room]/page.tsx  phase 4
    not-found.tsx         不中
    actions/contact.ts    server action
  components/
    shell/                Header, Menu, Footer, ModeSwitch, PageWipe, HoldemProgress
    squares/              engine, shapes/ (name, latin, map, chart, buzhong)
    chapters/             Opening, TwoHomes, Chart, Work, Stack, OffTheClock, Connect
    ui/                   Button, Chip, Field, Plaque, Card
  content/                site.ts, timeline.ts, projects/*.mdx, stack.ts, gear.ts, games.ts, facts.ts
  lib/                    motion.ts (tokens), sun.ts, time.ts, life.ts (split, crossover, year of study), hanzi/ (stroke data JSON)
public/                   Frank-Fu-CV.pdf, audio/name.m4a (later)
```

### Content model (TypeScript)

```ts
type Site = {
  name: { display: "Frank Fu"; legal: "Youyang Fu"; chinese: "付优扬"; pinyin: "Fù Yōuyáng" };
  domain: "youyangfu.com";
  intro: string;
  education: { degree: string; institution: string; start: "2024-03"; expectedEnd: "2027-11" };
  links: { github: string; linkedin: string; cv: "/Frank-Fu-CV.pdf" };
  places: { hometown: Place; home: Place };
  life: { born: string; arrived: string; arrivedApprox: boolean }; // ISO dates, see section 1 note
};
type Place = { name: string; chinese?: string; lat: number; lon: number; tz: string };

type Candle = {
  id: string; title: string; from: string; to?: string; // to omitted = current, still forming
  market: "ZCE" | "NZX"; open: number; close: number; high: number; low: number;
  highNote?: string; lowNote?: string; summary?: string;
  kind: "life" | "education" | "work";
};
type Flag = { date: string; label: string };

type Project = {
  slug: string; title: string; year: number; role: string; stack: string[];
  status: "live" | "shipped" | "in-progress" | "archived";
  summary: string; links: { label: string; href: string }[]; cover?: string;
};
type Tool = { name: string; area: "Languages" | "Frontend" | "Backend" | "Data" | "Tools"; since: number; projects: string[] };
type Gear = { slot: "racket" | "strings" | "shirt" | "shoes" | "grip" | "bag"; name: string; detail: string };
type Game = { title: string; hours?: number; rank?: string; main?: string };
type Fact = { card: string; text: string }; // e.g. card "K♠"
```

---

## 8. Contact form

- Server action `sendMessage(formData)`: validate with zod (name 1–80, email, topic from the chip list, message 10–4000); reject if the hidden honeypot field is filled; rate-limit per IP (start with an in-memory limiter; move to Upstash or Vercel KV if spam appears).
- Send with Resend: `from: CONTACT_FROM_EMAIL`, `to: CONTACT_TO_EMAIL`, `replyTo:` the visitor's email, subject `[youyangfu.com] <topic>: <name>`.
- Env vars (in `.env.local`, ignored by git; template in `.env.example`; mirror in Vercel): `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL`, `RESEND_API_KEY`.
- Until youyangfu.com is verified in Resend (DNS records at the registrar), send from `onboarding@resend.dev`, which only delivers to the Resend account owner's address. Sign up for Resend with the destination address.
- Client states: idle, sending, sent (seal stamp), error (message kept, reason shown). Error copy says what happened and what to do.

---

## 9. Phase 1: what was built

Built on 2026-11-13. The whole frame and style are in place with every chapter at its final layout, so later phases add content and set pieces without restructuring.

- [x] Tokens, fonts (Instrument Sans; LXGW WenKai cut down to the characters in use, about 9 KB), base styles
- [x] Mode system: Light / Dark / Now, applied before first paint, persisted, refreshed each minute in Now mode
- [x] Header (hides on scroll down, current-chapter underline), phone menu, footer with live clocks and life split
- [x] Lenis smooth scrolling; anchor links scroll smoothly and clear the fixed header
- [x] Square-wipe route transition (plain navigation under reduced motion)
- [x] Squares engine (`glyph-scene.ts`) and the opening: writing, flight, seal, hover or tap to switch scripts, skip on scroll, short repeat-visit version, reduced-motion still
- [x] 壹 Two homes: a real Asia-Pacific map drawn in squares from Natural Earth data, both cities, the flight arc, "Flip the world", live life split and crossover line
- [x] 贰 The chart: candles from `timeline.ts`, colour convention flipping at the move, snapping crosshair with price tag, detail card, keyboard and touch support, flags, Chart / List switch
- [x] 叁 Work: index with cursor-following generated covers; `/work/[slug]` case study pages
- [x] 肆 Stack: towers of plaques with selection, keyboard movement and project links
- [x] 伍 Off the clock: Court (cube-built hologram with gear you can point at), Table (the hand, dealt a street at a time), Arcade (save files)
- [x] 陆 Let's connect: validated form, honeypot, rate limit, Resend delivery, sent and error states with the seal stamp
- [x] Experience (Sandfield, Harmoney, PB Technologies) in the Work chapter, with a link to the CV PDF; `not-found` 不中 written in squares
- [x] Metadata with all three names, Person JSON-LD, share image, seal favicon and app icon, `sitemap.xml`, `robots.txt`
- [ ] Deployed to Vercel (needs the owner's account; see below)

Measured on the production build (`next build`, `next start`), Lighthouse phone emulation, home page: performance 99, accessibility 100, best practices 100, SEO 100, layout shift 0. Every route prerenders as static HTML.

Not verified: real email delivery (no Resend API key exists yet), and behaviour on physical phones and in Safari or Firefox (checked in Chrome only).

### Before launch

1. Replace placeholder content. Every block still holding sample data shows a "Placeholder content" note naming its file in `src/content/`. When they are all gone, set `showDraftNotes: false` in `src/content/site.ts`.
2. ~~Fill in `site.links`~~ Done: GitHub, LinkedIn and the CV PDF.
3. Create a Resend account with the destination address, add `RESEND_API_KEY`, `CONTACT_TO_EMAIL` and `CONTACT_FROM_EMAIL` to Vercel, send a test message, then verify youyangfu.com in Resend and switch the sender to an address on the domain.
4. Import the repo into Vercel and point youyangfu.com at it.
5. Run `npm run fonts` if any Chinese text was added, and `npm run icons` if the opening changed.

### Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on localhost:3000. Single chapters at `/preview/<chapter>` (development only). |
| `npm run build` | Production build. |
| `npm run typecheck`, `npm run lint` | Types and lint. |
| `npm run fonts` | Rebuilds the Chinese font subset from the characters found in `src/`. |
| `npm run icons` | Regenerates the favicon, app icon and share image (needs the dev server running). |
| `node scripts/shot.mjs <path> <out.png>` | Screenshots a page in any mode, size or interaction state. |
| `node scripts/build-land-grid.mjs` | Regenerates the map's land squares. |

## 10. Later phases

2. **Set pieces:** Two homes scroll scene (the map, marks and flip already exist; add the pinned scroll steps), full chart scene (draw on scroll, zoom, moving ticker, live candle, rolling axis numbers), Hold'em progress corner, character breakdown on hover, name audio. Load GSAP ScrollTrigger here and sync it to Lenis.
3. **Real content:** full project case studies, best and hardest moments on the chart, the year each tool was first used.
4. **Off the clock:** voxel avatar with gear hotspots, smash meter, Table, Arcade.
5. **Delight and polish:** hidden cards easter egg, 404 rally game, sound, performance pass, analytics.

## 11. Open items

Decisions (proposed, keep unless the owner says otherwise):
- Chapter numerals 壹 贰 叁 肆 伍 陆.
- Menu labels About, Work, Play, Contact, CV (CV opens the PDF in a new tab).
- Chart codes FYY0603 (ZCE) and FRK (NZX).
- Hold'em corner as progress indicator.
- Whether to publish the exact birth date or only the month and year.

Received 2026-11-13: GitHub and LinkedIn links, and the CV (education, experience, projects, leadership and skills are now in `src/content/`). The CV PDF itself is not published because it carries a phone number and email address.

Content still pending from the owner: a full write-up for each project, the year each tool was first used, the best and hardest moment of each life chapter, gear models, the games played, favourite starting hand, face photo, name recording, arrival day, and whether to publish the exact birth date.

Placeholder notes ("Placeholder content. Replace it in ...") show only in development, never on the live site.
