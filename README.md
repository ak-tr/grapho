# Grapho

Make graphs from your own data, then export them as images or animations. Svelte 5 in Astro, styled with the [Mosaic](https://github.com/ak-tr/mosaic) design system, hosted on Cloudflare. Everything runs in the browser: your data never leaves it.

1. **Data:** import or paste CSV, TSV or JSON. The separator is detected (comma, tab, semicolon, pipe), and dates and decimal commas are read as you'd expect. Pick an X column and the values to show, on a left or right Y axis.
2. **Chart:** line, area, bar, scatter or pie. Set axis names, ranges, units, smoothing, font, size and colours, or start from a Mosaic theme.
3. **Animate:** build a list of steps. Each one draws, fades or grows the axes or a series, with its own duration and easing, after or alongside the step before.
4. **Export:** SVG or PNG for a still, MP4 or GIF for the animation, at the frame rate you pick.

Charts save in your browser's local storage and reopen from **Charts**.

## Running and deploying

- `pnpm dev`: the app with hot reload on `localhost:4321`.
- `pnpm test`: checks parsing, the timeline and the renderer.
- `pnpm preview`: builds and serves the site through Wrangler, as Cloudflare will.
- `pnpm run deploy`: builds and deploys to Cloudflare Workers (static assets, see `wrangler.jsonc`). `pnpm deploy` without `run` is a different, built-in pnpm command.

## How it works

`render(table, config, t)` in `src/lib/render.ts` returns the chart at time `t` as an SVG string. The preview, the timeline scrubber and every export call it, so what you see is what you get. MP4s are encoded in the browser with WebCodecs (via [Mediabunny](https://mediabunny.dev)), GIFs with [gifenc](https://github.com/mattdesl/gifenc).

## Licence

[MIT](LICENSE)
