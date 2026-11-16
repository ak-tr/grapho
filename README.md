# Grapho

Make graphs from your own data, then export them as images or animations. Svelte 5 in Astro, styled with the [Mosaic](https://github.com/ak-tr/mosaic) design system, hosted on Cloudflare. Everything runs in the browser: your data never leaves it.

- **Setup:** import or paste CSV, TSV or JSON. The separator is detected (comma, tab, semicolon, pipe), and dates and decimal commas are read as you'd expect. Pick the chart type: line, area, scatter, vertical or horizontal bar, or pie. Long data (date, name, value) can be split into one series per name.
- **Series:** pick the columns to show, each with its colour and a left or right Y axis, and how they're drawn: line shape, smoothing, values on bars or at line ends.
- **Axes:** names, ranges and ticks, and how numbers are written (unit, decimals, 2.5k, percent).
- **Labels:** title, key, watermark.
- **Style:** colours (start from a Mosaic colour way or save your own), font and text size, grid lines, size and padding.
- **Animate:** a list of steps. Each one draws, fades, grows or brings in bars one by one, with its own duration and easing, after or alongside the step before.
- **Export**, in the header: SVG or PNG for a still, MP4 or GIF for the animation, at the frame rate you pick.

Most of it can also be edited by clicking the chart itself, or from the keyboard: Tab into the chart, move between its parts with the arrows and press Enter. Charts save in your browser's local storage and reopen from **Charts** in the header. **Theme** in the header switches the app between the five Mosaic themes; the chart keeps its own colours.

## Running and deploying

- `pnpm dev`: the app with hot reload on `localhost:4321`.
- `pnpm test`: checks parsing, the timeline and the renderer.
- `pnpm preview`: builds and serves the site through Wrangler, as Cloudflare will.
- `pnpm run deploy`: builds and deploys to Cloudflare Workers (static assets, see `wrangler.jsonc`). `pnpm deploy` without `run` is a different, built-in pnpm command.

## How it works

`render(table, config, t)` in `src/lib/render.ts` returns the chart at time `t` as an SVG string. The preview, the timeline scrubber and every export call it, so what you see is what you get. MP4s are encoded in the browser with WebCodecs (via [Mediabunny](https://mediabunny.dev)), GIFs with [gifenc](https://github.com/mattdesl/gifenc).

## Licence

[MIT](LICENSE)
