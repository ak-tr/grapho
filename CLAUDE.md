# Grapho

Graph maker with animation. Astro + Svelte 5, Tailwind 3, hosted on Cloudflare Workers static assets. Everything runs in the browser.

- Follow the Mosaic design guide in `node_modules/mosaic/DESIGN.md` for all UI.
- Exception: the chart itself is not Mosaic. Its colours live in each chart's config (hex), so exports look the same anywhere.
- `render(table, config, t)` in `src/lib/render.ts` returns the chart at time `t` as an SVG string. Preview, scrubbing and every export (SVG, PNG, MP4, GIF in `src/lib/export.ts`) go through it. Don't use CSS transitions for chart motion.
- Animation is a list of steps (`src/lib/timeline.ts`). A target with no step is shown from the start.
- Every visit starts on a blank chart. Charts with data autosave (and save on page hide) to localStorage (`src/lib/store.ts`) and reopen from the Charts tab.
- The page shell (h-12 header, mono uppercase frame) matches the other ak-tr apps (bins, stash).
- `pnpm test` runs the logic checks in `src/lib/*.test.ts`.
