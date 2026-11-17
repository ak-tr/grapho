# @ak-tr/grapho

[![npm version](https://img.shields.io/npm/v/@ak-tr/grapho)](https://www.npmjs.com/package/@ak-tr/grapho)

The chart renderer from [Grapho](https://grapho.akif.kr) as a package: line, area, scatter, bar and pie charts, animated, drawn as SVG. Works in any framework, or on the server.

```sh
npm install @ak-tr/grapho
```

## Draw a chart

```js
import { draw } from "@ak-tr/grapho";

const chart = draw(document.getElementById("chart"), [
    { month: "2026-01-01", north: 12, south: 8 },
    { month: "2026-02-01", north: 18, south: 11 },
], { type: "line", title: "Sales" });

chart.play(); // the animation; chart.seek(ms) shows one moment of it, chart.stop() ends it
```

The chart fills the element's width. Data can be CSV, TSV or JSON text, an array of rows, or an object of columns (`{ month: [...], north: [...] }`). Numbers and ISO dates are typed for you.

## Options

Every option is optional. Whatever you leave out is picked for your data: a date column for X, up to four number columns as series, a dark theme. The main ones:

| Option | |
|---|---|
| `type` | `"line"`, `"area"`, `"scatter"`, `"bar"`, `"hbar"`, `"pie"` |
| `x`, `ys` | The X column, and the columns plotted as series |
| `title`, `xLabel`, `yLabel` | Text on the chart |
| `yMin`, `yMax`, `unit`, `decimals`, `percent` | The Y axis and how numbers are written |
| `colors` | `{ background, text, axis, grid, series: { north: "#1b9e77" } }`, hex |
| `width`, `height` | The chart's own size in px (it's scaled to fit) |
| `font`, `fontSize` | `"geist-mono"` (default), `"onest"`, `"sans"`, `"serif"`, `"mono"` |
| `anim` | `{ steps, hold }`: what animates, in what order, for how long |

The `Config` type lists them all. Geist Mono and Onest aren't bundled: load them on your page, or the chart falls back to the system monospace or sans-serif font.

## Without a DOM

```js
import { svg } from "@ak-tr/grapho";
const markup = svg("day,a\n1,10\n2,15", { type: "bar" }); // a string: save it, send it, inline it
```

`chart(data, options)` returns the parsed table and the full config, and `render(table, config, ms)` draws any moment of the animation.
