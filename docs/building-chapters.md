# Building on the foundation

How to add or change a section without breaking the system. Read this with [`blueprint.md`](blueprint.md) (what to build) and [`blueprint-wireframes.html`](blueprint-wireframes.html) (what it looks like; open it in a browser, or read the SVG for a chapter).

## Ground rules

- **Next.js 16 is not the Next.js you know.** Before using a Next API you're unsure about, read its guide in `node_modules/next/dist/docs/`. `cacheComponents` is on: a server component must not read the current time, random values, cookies or headers while rendering. Anything live (clocks, counters, "now") belongs in a client component that fills itself in after hydration (see `src/components/ui/Live.tsx`).
- **Content never lives in components.** Copy and data come from `src/content/*.ts`. If a section needs a new field, add it to that section's content file and to `src/content/types.ts`.
- **The owner's email address never appears in code, content or docs.** Only `process.env.CONTACT_TO_EMAIL` on the server.
- **Server components by default.** Add `"use client"` only to the smallest piece that needs state, effects or event handlers.
- **Every animation needs a still version.** Check `prefers-reduced-motion` (CSS media query, or `prefersReducedMotion()` from `src/lib/motion.ts`). Only the opening and live data may move on their own; everything else answers the visitor's scroll, pointer or keyboard.
- **Works from 360px wide up to 2560px**, by keyboard as well as pointer. Hover effects need a touch and focus equivalent.

## The look, in one paragraph

Rice paper, ink, one accent. Type does most of the work: Instrument Sans, set tight at large sizes, left-aligned, with generous space around it. Squares on an 8px lattice are the only decorative material. Corners are 2px. No shadows on ordinary blocks, no gradients, no pills, no emoji, no all-caps eyebrow labels, no monospace "data" labels, no middle-dot separators, no arrows appended to link text. Cinnabar is used sparingly: the seal, a current or focused thing, one highlighted datum. If a section looks like a SaaS template, it's wrong.

## Tokens (defined in `src/app/globals.css`)

Colours, as Tailwind utilities (`bg-*`, `text-*`, `border-*`, `fill-*`, `stroke-*`) and as CSS variables:

| Utility name | Variable | Use |
|---|---|---|
| `paper` | `--paper` | Page background |
| `surface` | `--surface` | Raised surfaces: inputs, cards that must separate |
| `ink` | `--ink` | Text, squares |
| `ink-soft` | `--ink-soft` | Secondary text (passes AA on paper) |
| `grid` | `--grid` | Hairlines, lattice |
| `line` | `--line` | Borders, controls |
| `cinnabar` | `--cinnabar` | The accent. Also "up" on ZCE, "down" on NZX |
| `jade` | `--jade` | Chart only. "Down" on ZCE, "up" on NZX |

Never write a hex colour in a component. In Now mode the variables change through the day, so anything drawn on canvas must re-read them on the `modechange` window event.

Type sizes: `text-display` (76), `text-title` (52), `text-heading` (36), `text-subhead` (26), `text-lead` (20), `text-body` (17, the default), `text-small` (14), `text-tiny` (12). The large ones are fluid and carry their own line-height and tracking. Weights: 400, 500, 600.

Helpers: `wrap` (page frame: centred, max 1440px, side margins), `grid-12` (12 columns, 24px gutters), `chapter-space` (vertical rhythm between chapters), `measure` (max 68ch), `han` (Chinese text in the Kai face; also add `lang="zh-Hans"`), `tnum` (tabular figures), `link` (quiet underline that turns cinnabar).

Motion: `ease-brush`, `ease-flight`, `ease-settle`, `ease-reveal` as Tailwind easing utilities, and the same curves in `src/lib/motion.ts` (`EASE_CSS`, `EASE_POINTS` for the Motion library, `ease.*` functions for canvas, `DURATION`). Durations: 160ms hover feedback, 320ms interface changes, 600ms reveals, 720ms squares in flight. Use `duration-[160ms]`, `duration-[320ms]`.

## Shared pieces

- `Chapter` (`src/components/ui/Chapter.tsx`): wraps a home-page chapter with its anchor, numeral and heading. Takes `id` and optional `aside` (content at the right of the heading row). Do not render your own chapter heading.
- `DraftNote`: the small "Placeholder content" line. Show it under any block that still holds sample data.
- `Button`, `buttonClass()`, `fieldClass`, `chipClass` (`src/components/ui/Button.tsx`).
- `Seal` (`src/components/ui/Seal.tsx`): the name seal as crisp SVG at any size.
- `LiveClock`, `LifePercent` (`src/components/ui/Live.tsx`).
- `TransitionLink` (`src/components/shell/PageWipe.tsx`): use it instead of `next/link` for internal links. It smooth-scrolls to anchors on the same page and plays the square wipe between routes.
- `useScroll()` (`src/components/shell/SmoothScroll.tsx`): `scrollTo("#id")`, `lock(true)`.
- `cn()` (`src/lib/cn.ts`), `src/lib/time.ts`, `src/lib/life.ts`, `src/lib/sun.ts`, `src/lib/hanzi` (stroke data).
- Chinese characters: after adding any new ones to `src/`, run `npm run fonts` to rebuild the font subset.

## Checking your work

Start the dev server with `npm run dev` (http://localhost:3000). If several agents share one server, none of them should start another or run `next build`. The dev server occasionally misses a file change after a burst of edits or an `npm install`: if a page looks stale, re-save the file, and if that fails, restart the server.

Each chapter has an isolated preview route (development only; they return 404 on the live site): `/preview/two-homes`, `/preview/chart`, `/preview/work`, `/preview/stack`, `/preview/play`, `/preview/connect`.

```bash
# Types and lint (lint only your own files)
npx tsc --noEmit
npx eslint src/components/chapters/YourFile.tsx

# Screenshots (see the header of scripts/shot.mjs for every option)
node scripts/shot.mjs preview/chart shots/chart-light.png --full --mode light --errors
node scripts/shot.mjs preview/chart shots/chart-dark.png  --full --mode dark
node scripts/shot.mjs preview/chart shots/chart-phone.png --full --mode light --w 390 --h 844
node scripts/shot.mjs preview/chart shots/chart-hover.png --mode light --hover "[data-candle='uoa-1']"
```

Write paths without a leading slash (Git Bash rewrites them). `shots/` is ignored by git. Look at every screenshot you take: check alignment to the grid, text contrast in both modes, nothing clipped or overlapping, and no sideways scroll on the phone shot (the tool warns about it).
