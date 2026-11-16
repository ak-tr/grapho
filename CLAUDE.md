# Grapho

Graph maker with animation. Astro + Svelte 5, Tailwind 3, hosted on Cloudflare Workers static assets. Everything runs in the browser.

- Follow the Mosaic design guide in `node_modules/mosaic/DESIGN.md` for all UI.
- Exception: the chart itself is not Mosaic. Its colours live in each chart's config (hex), so exports look the same anywhere.
- `render(table, config, t)` in `src/lib/render.ts` returns the chart at time `t` as an SVG string. Preview, scrubbing and every export (SVG, PNG, MP4, GIF in `src/lib/export.ts`) go through it. Don't use CSS transitions for chart motion.
- Animation is a list of steps (`src/lib/timeline.ts`). A target with no step is shown from the start.
- Every visit starts on a blank chart. Charts with data autosave (and save on page hide) to localStorage (`src/lib/store.ts`) and reopen from the Charts menu in the header.
- The sidebar has six tabs (3 × 2), each about one thing: Setup (the data, chart type and the data's shape), Series (what is plotted and how it is drawn), Axes (names, ranges, number format), Labels (title, key, watermark), Style (colours, font, grid, size, padding), Animate. Charts and Export are header menus.
- The page shell (h-12 header, mono uppercase frame) matches the other ak-tr apps (bins, stash). The header's theme picker switches the Mosaic theme for the app (not the chart), saved as `grapho:theme` and applied before paint in `index.astro`.
- `can-hover:` is a Tailwind variant, not a screen: a non-width screen silently turns off the `max-*` variants.
- `pnpm test` runs the logic checks in `src/lib/*.test.ts`.
- Keyboard access on the chart (Tab in, arrows between parts, Enter to edit, Alt+arrows move the key) and drag-to-reorder animation steps use UI SDK (`@ui-sdk/core`, beta, pinned). The primitives are in `src/lib/primitives.ts`; `src/components/ui` renders them by hand with `usePrimitive`/`usePart`, because in 0.1.0-beta.3 content passed into a `createParts` component doesn't update.
