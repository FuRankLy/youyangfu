@AGENTS.md

# youyangfu.com

Personal site of Frank Fu (付优扬, legal name Youyang Fu).

- **Build spec:** `docs/blueprint.md`. Read it before working on the site; it defines the chapters, design tokens, motion tokens, content model and phase scope.
- **Opening sequence reference:** `docs/prototypes/opening-sequence.html`. Port its logic into the squares engine rather than rewriting from scratch.
- **Privacy:** never put the owner's email address or phone number in code, content or docs. The contact form and the Email link in Let's connect read `CONTACT_TO_EMAIL` from the environment (`.env.local`, ignored by git); the owner chose to show the address on the page, but it is never written into the repository. The one exception is `public/Frank-Fu-CV.pdf`, which the owner chose to publish as is.
- **Content vs layout:** all copy and data live in `src/content/`. Components never hardcode it.
- **Motion:** use only the motion tokens in the spec. Every animation needs a `prefers-reduced-motion` path.
- **Year of study:** derived from the 2024 start date, never typed by hand.
