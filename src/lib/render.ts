import { extent } from "d3-array";
import { scaleBand, scaleLinear, scalePoint, scaleTime } from "d3-scale";
import { arc, area, curveLinear, curveMonotoneX, curveStepAfter, line, pie } from "d3-shape";
import { kind, label, numeric, smooth, type Reshape, type Table } from "./data.ts";
import { at, each, type Animation, type Step } from "./timeline.ts";

/** "bar" grows up from the X axis, "hbar" grows right from the categories down the side */
export type ChartType = "line" | "area" | "bar" | "hbar" | "scatter" | "pie";
export type Curve = "linear" | "smooth" | "step";
export const TYPE_NAMES: Record<ChartType, string> = { line: "Line", area: "Area", scatter: "Scatter", bar: "Vertical bar", hbar: "Horizontal bar", pie: "Pie" };
/** What each data-edit tag is called, for the keyboard layer and the editor's heading (series are "series:<name>") */
export const PART_NAMES: Record<string, string> = { title: "Title", legend: "Key", x: "X axis", y: "Y axis", y2: "Right Y axis", xLabel: "X axis name", yLabel: "Y axis name", yLabel2: "Right Y axis name", background: "Chart background" };

export const FONTS = {
    "geist-mono": { name: "Geist Mono", css: "'Geist Mono', monospace" },
    onest: { name: "Onest", css: "Onest, sans-serif" },
    sans: { name: "Sans serif", css: "Helvetica, Arial, sans-serif" },
    serif: { name: "Serif", css: "Georgia, 'Times New Roman', serif" },
    mono: { name: "System mono", css: "ui-monospace, Menlo, Consolas, monospace" },
};
export type Font = keyof typeof FONTS;
export type Config = {
    type: ChartType;
    x: string;
    ys: string[];
    curve: Curve;
    window: number;
    xLabel: string;
    yLabel: string;
    yMin: number | null;
    yMax: number | null;
    /** Series drawn against a second Y axis on the right, which has its own name, range and unit */
    right: string[];
    yLabel2: string;
    yMin2: number | null;
    yMax2: number | null;
    unit2: string;
    ticks: number;
    unit: string;
    decimals: number;
    /** Values are fractions (0.25): shown ×100 with a % sign */
    percent?: boolean;
    /** Long data: filter rows and split series by a column, applied before charting (see reshape in data.ts) */
    reshape?: Reshape | null;
    /** false writes large numbers out in full (2,500 instead of 2.5k). Unset = shortened. */
    compact?: boolean;
    /** Shown top left, above the key. Empty = none. */
    title?: string;
    legend: boolean;
    /** Where the dragged legend's top-left sits, as fractions of width and height. Unset = above the plot. */
    legendAt?: { x: number; y: number } | null;
    /** One key entry per row instead of side by side */
    legendStack?: boolean;
    endLabels: boolean;
    /** Bar charts: each bar's value past its end, inside its end, or none. Unset = past the end if endLabels is on. */
    barValues?: "off" | "end" | "inside";
    /** Bar charts with several series: side by side in each category, or overlaid at the same size, biggest at the back. Unset = side by side. */
    barLayout?: "group" | "overlay";
    grid: boolean;
    lineWidth: number;
    pointSize: number;
    donut: number;
    width: number;
    height: number;
    /** The Grapho logo and grapho.akif.kr in a strip along the bottom right */
    watermark?: boolean;
    /** Empty space (px) between the chart's edges and everything on it */
    padding?: number;
    fontSize: number;
    font: Font;
    colors: { background: string; transparent: boolean; text: string; axis: string; grid: string; series: Record<string, string> };
    anim: Animation;
};

// Pastels read on dark backgrounds, deeper colours on light ones. Picked from the background, so presets just work.
const ON_DARK = ["#8dd3c7", "#feffb3", "#bebada", "#fa8072", "#80b1d3", "#fdb462", "#b3de69", "#fccde5"];
const ON_LIGHT = ["#1b9e77", "#d95f02", "#7570b3", "#e7298a", "#66a61e", "#c49a00", "#a6761d", "#666666"];

/** Whether a hex colour is light enough to want dark things on it */
const bright = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 140;
};
/** Text that reads on a series' bars */
const onBar = (c: Config, name: string, i: number) => (bright(seriesColor(c, name, i)) ? "#111111" : "#ffffff");

export function palette(c: Config) {
    return !c.colors.transparent && bright(c.colors.background) ? ON_LIGHT : ON_DARK;
}

export const seriesColor = (c: Config, name: string, i: number) => c.colors.series[name] ?? palette(c)[i % 8];

export const defaultSteps = (c: Pick<Config, "ys" | "type">): Step[] => [
    { target: "axes", effect: "fade", ms: 500, ease: "out", together: false },
    ...c.ys.map((y): Step => ({ target: y, effect: c.type === "line" || c.type === "area" ? "draw" : "grow", ms: 1500, ease: c.type === "line" || c.type === "area" ? "linear" : "out", together: false })),
];

export function defaults(table: Table): Config {
    // A date or time column makes the best X axis; ID columns are rarely worth plotting
    const x = table.columns.find((c) => kind(table, c) === "date") ?? table.columns[0] ?? "";
    const ys = numeric(table).filter((c) => c !== x && !/^id$/i.test(c)).slice(0, 4);
    return {
        type: "line", x, ys, curve: "linear", window: 1,
        xLabel: x, yLabel: ys.length === 1 ? ys[0] : "", yMin: null, yMax: null, ticks: 6,
        right: [], yLabel2: "", yMin2: null, yMax2: null, unit2: "",
        unit: "", decimals: 1, compact: true, percent: false, reshape: null, title: "", legend: true, legendAt: null, legendStack: false, endLabels: true, grid: true,
        lineWidth: 3, pointSize: 5, donut: 0.5,
        width: 1200, height: 600, padding: 0, watermark: false, fontSize: 18, font: "geist-mono",
        colors: { background: "#111111", transparent: false, text: "#a3a3a3", axis: "#525252", grid: "#262626", series: {} },
        anim: { steps: defaultSteps({ ys, type: "line" }), hold: 1500, rescale: false, fps: 30, gifFps: 25 },
    };
}

// The logo's 7 × 7 tiles (public/favicon.svg), 1 = lit
const LOGO = ["0000000", "0011100", "0000010", "0011110", "0100010", "0011110", "0000000"];

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`);
const r2 = (v: number) => Math.round(v * 100) / 100;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

type Pt = [x: number, y: number | null];

/** Points (sorted by x) up to `cut`, ending exactly on `cut`. */
export function clip(pts: Pt[], cut: number): Pt[] {
    const out: Pt[] = [];
    for (const [i, [x, y]] of pts.entries()) {
        if (x <= cut) {
            out.push([x, y]);
            continue;
        }
        const prev = pts[i - 1];
        if (prev && prev[1] != null && y != null) out.push([cut, prev[1] + ((y - prev[1]) * (cut - prev[0])) / (x - prev[0])]);
        break;
    }
    return out;
}

/** 2500 → "2.5k", 1250000 → "1.25m". Below 1,000 `small` formats it. Rounding up to the next unit counts (999,999.6 → "1m"). */
export function compact(v: number, small: (v: number) => string): string {
    for (const [n, suffix] of [[1e9, "b"], [1e6, "m"], [1e3, "k"]] as const) if (Math.abs(v) >= n * (1 - 5e-6)) return `${+(v / n).toFixed(2)}${suffix}`;
    return small(v);
}

// Text widths are measured with a canvas in the browser, so any font gets the room it needs.
// Outside a browser (tests) they're estimated from the character count.
const widths = new Map<string, number>();
let measurer: OffscreenCanvasRenderingContext2D | null | undefined;
if (typeof document !== "undefined") document.fonts?.addEventListener("loadingdone", () => widths.clear());

export function textWidth(text: string, c: Pick<Config, "font" | "fontSize">): number {
    const font = `${c.fontSize}px ${(FONTS[c.font] ?? FONTS["geist-mono"]).css}`;
    const key = `${font}\n${text}`;
    let w = widths.get(key);
    if (w == null) {
        measurer ??= typeof OffscreenCanvas === "undefined" ? null : new OffscreenCanvas(1, 1).getContext("2d");
        if (measurer) (measurer.font = font), (w = measurer.measureText(text).width);
        else w = text.length * c.fontSize * 0.62;
        if (widths.size > 5000) widths.clear();
        widths.set(key, w);
    }
    return w;
}

type EndLabel = { x: number; y: number; w: number; text: string; color: string; op: number; name: string };

/** Moves labels that would overlap apart vertically, at least `gap` between centres, keeping them inside [top, bottom]. */
export function stack<L extends { x: number; y: number; w: number }>(labels: L[], gap: number, top: number, bottom: number): L[] {
    const out = labels.map((l) => ({ ...l })).sort((a, b) => a.y - b.y);
    const near = (a: L, b: L) => a.x < b.x + b.w && b.x < a.x + a.w;
    // Push down past anything above that shares horizontal space
    out.forEach((l, i) => {
        for (const p of out.slice(0, i)) if (near(l, p)) l.y = Math.max(l.y, p.y + gap);
    });
    // Then pull back up from the bottom edge, carrying overlapping neighbours with it
    for (let i = out.length - 1; i >= 0; i--) {
        const l = out[i];
        l.y = Math.min(l.y, bottom);
        for (const n of out.slice(i + 1)) if (near(l, n)) l.y = Math.min(l.y, n.y - gap);
        l.y = Math.max(l.y, top);
    }
    return out;
}

/** The key is always fully shown, even while its series are still animating in */
type LegendItem = { name: string; color: string; attr: string };

/** Legend laid out from its own top-left corner, wrapping at the chart width */
function legend(items: LegendItem[], c: Config, width: number) {
    const fs = c.fontSize;
    let x = 0;
    let y = fs * 0.75;
    let w = 0;
    const parts = items.map((it) => {
        const iw = textWidth(it.name, c) + fs * 2.4;
        if ((c.legendStack || x + iw > width - fs * 2.4) && x > 0) (x = 0), (y += fs * 1.6);
        const s = `<g${it.attr}><rect x="${r2(x)}" y="${r2(y - fs * 0.75)}" width="${r2(fs * 0.8)}" height="${r2(fs * 0.8)}" fill="${esc(it.color)}"/><text x="${r2(x + fs * 1.3)}" y="${r2(y)}" fill="${esc(c.colors.text)}">${esc(it.name)}</text></g>`;
        w = Math.max(w, x + iw - fs * 1.1);
        x += iw;
        return s;
    });
    return { svg: parts.join(""), w, h: y + fs * 0.25 };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/**
 * The whole chart at time `t` (ms) as an SVG string. Pure: playback, scrubbing and export all call this.
 * `edit` (the preview only) tags parts with data-edit and adds hit areas, so they can be clicked and dragged.
 */
export function render(table: Table, c: Config, t: number, fontCss = "", edit = false): string {
    const fs = c.fontSize;
    // Everything is laid out in the space inside the padding (W × H), then moved in by P; the background fills it all
    const P = Math.max(0, Math.min(c.padding ?? 0, Math.min(c.width, c.height) / 2 - 50));
    const W = c.width - P * 2;
    // The watermark gets its own strip along the bottom, so it never sits on top of anything
    const WM = c.watermark ? fs * 1.8 : 0;
    const H = c.height - P * 2 - WM;
    const pct = c.percent ? "%" : "";
    const num = (v: number, small: (v: number) => string) => (c.compact === false ? small(v) : compact(v, small));
    const tag = (what: string) => (edit ? ` data-edit="${esc(what)}"` : "");
    const hit = (what: string, x: number, y: number, w: number, h: number) => (edit && w > 0 && h > 0 ? `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" fill="transparent"${tag(what)}/>` : "");
    const state = at(c.anim, t);
    const ys = c.ys.filter((y) => table.columns.includes(y));
    const xKind = kind(table, c.x);
    let rows = table.rows.filter((r) => r[c.x] != null);
    if (xKind !== "category" && c.type !== "pie") rows = [...rows].sort((a, b) => +a[c.x]! - +b[c.x]!);
    const k = c.percent ? 100 : 1;
    const vals = ys.map((y) => smooth(rows.map((r) => (typeof r[y] === "number" ? (r[y] as number) * k : null)), c.window));
    // The title sits top left; everything else starts below it
    const titleH = c.title ? fs * 2.6 : 0;
    const ts = state("title");
    const title = c.title ? `<text x="${r2(fs * 1.2)}" y="${r2(fs * 2)}" font-size="${r2(fs * 1.4)}" font-weight="500" fill="${esc(c.colors.text)}" opacity="${r2(ts.p)}"${tag("title")}>${esc(c.title)}</text>` : "";
    const body = c.type === "pie" ? pieChart() : cartesian();
    const bg = c.colors.transparent ? hit("background", 0, 0, c.width, c.height) : `<rect width="${c.width}" height="${c.height}" fill="${esc(c.colors.background)}"/>`;
    const content = body + title + (WM ? watermark() : "");
    const inner = P ? `<g transform="translate(${r2(P)} ${r2(P)})">${content}</g>` : content;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${c.width}" height="${c.height}" viewBox="0 0 ${c.width} ${c.height}" font-family="${(FONTS[c.font] ?? FONTS["geist-mono"]).css}" font-size="${fs}"${tag("background")}${edit ? ` data-inner="${r2(W)} ${r2(H)}"` : ""}>${fontCss && `<style>${fontCss}</style>`}${bg}${inner}</svg>`;

    /** The logo (the Mosaic tile grid, lit cells in the text colour) then the address, right-aligned under the chart */
    function watermark() {
        const small = fs * 0.75;
        const text = "grapho.akif.kr";
        const size = fs * 0.9;
        const cell = size / 7;
        const right = W - fs * 0.6;
        const x = right - textWidth(text, { font: c.font, fontSize: small }) - fs * 0.4 - size;
        const y = H + (WM - size) / 2;
        const cells = LOGO.flatMap((row, j) => [...row].map((on, i) => `<rect x="${r2(x + i * cell)}" y="${r2(y + j * cell)}" width="${r2(cell * 0.82)}" height="${r2(cell * 0.82)}" fill="${esc(on === "1" ? c.colors.text : c.colors.grid)}"/>`));
        return `<g opacity="0.7"${tag("background")}>${cells.join("")}<text x="${r2(right)}" y="${r2(H + WM / 2)}" dy="0.35em" text-anchor="end" font-size="${r2(small)}" fill="${esc(c.colors.text)}">${text}</text></g>`;
    }

    /** Above the plot (and taking room there), or wherever it was dragged to */
    function placeLegend(items: (Omit<LegendItem, "attr"> & { key?: string })[]) {
        if (!c.legend || !items.length) return { svg: "", height: titleH };
        const lg = legend(items.map((it) => ({ ...it, attr: tag(`series:${it.key ?? it.name}`) })), c, W);
        const at = c.legendAt;
        // Moved off the top, it sits on a patch of the chart background so lines behind it don't show through
        const pad = at ? fs * 0.6 : 0;
        const x = at ? clamp(at.x * W, pad, W - lg.w - pad) : fs * 1.2;
        const y = at ? clamp(at.y * H, pad, H - lg.h - pad) : titleH + fs * 0.85;
        const box = edit ? ` data-box="${r2(x)} ${r2(y)} ${r2(lg.w)} ${r2(lg.h)}"` : "";
        const patch = at && !c.colors.transparent ? `<rect x="${r2(-pad)}" y="${r2(-pad)}" width="${r2(lg.w + pad * 2)}" height="${r2(lg.h + pad * 2)}" fill="${esc(c.colors.background)}"/>` : "";
        const svg = `<g transform="translate(${r2(x)} ${r2(y)})"${tag("legend")}${box}>${patch}${hit("legend", 0, 0, lg.w, lg.h)}${lg.svg}</g>`;
        return { svg, height: at ? titleH : y + lg.h + fs * 0.35 };
    }

    function pieChart() {
        const y = ys[0];
        if (!y) return "";
        const st = state(y);
        const slices = rows.map((r, j) => {
            const name = label(r[c.x]);
            return { name, value: Math.max(0, vals[0][j] ?? 0), color: seriesColor(c, name, j) };
        });
        const lg = placeLegend(slices);
        const top = lg.height + fs;
        const radius = Math.max(0, Math.min(W, H - top) / 2 - fs) * (st.effect === "grow" ? st.p : 1);
        const limit = st.effect === "draw" ? st.p * Math.PI * 2 : Infinity;
        const n = slices.length;
        const shape = arc<{ startAngle: number; endAngle: number }>().innerRadius(radius * c.donut).outerRadius(radius).digits(2);
        const paths = pie<(typeof slices)[number]>().value((s) => s.value).sortValues(null)(slices)
            .map((a) => ({ ...a, endAngle: st.effect === "each" ? a.startAngle + (a.endAngle - a.startAngle) * each(st, a.index, n) : Math.min(a.endAngle, limit) }))
            .filter((a) => a.startAngle < limit && a.endAngle > a.startAngle)
            .map((a) => `<path d="${shape(a)}" fill="${esc(a.data.color)}" stroke="${esc(c.colors.transparent ? "none" : c.colors.background)}" stroke-width="2"${tag(`series:${a.data.name}`)}/>`);
        const op = st.effect === "fade" ? st.p : st.p > 0 ? 1 : 0;
        return `<g transform="translate(${r2(W / 2)} ${r2((top + H) / 2)})" opacity="${r2(op)}">${paths.join("")}</g>${lg.svg}`;
    }

    function cartesian() {
        const out: string[] = [];
        const lineish = c.type === "line" || c.type === "area";
        const horiz = c.type === "hbar";
        const onRight = new Set(horiz ? [] : (c.right ?? []).filter((y) => ys.includes(y)));
        const all = ys.map((_, i) => i);
        const leftIdx = all.filter((i) => !onRight.has(ys[i]));
        const rightIdx = all.filter((i) => onRight.has(ys[i]));
        const dual = leftIdx.length > 0 && rightIdx.length > 0;

        // y: one domain per axis, optionally growing to fit each series as it comes in
        const exts = vals.map((v) => extent(v.filter((n): n is number => n != null)) as [number, number] | [undefined, undefined]);
        function domain(idx: number[], min: number | null, max: number | null): [number, number] | null {
            if (!idx.length) return null;
            const fit = ([a, b]: [number, number]): [number, number] => {
                if (c.type === "bar" || c.type === "hbar" || c.type === "area") (a = Math.min(0, a)), (b = Math.max(0, b));
                if (min != null) a = min;
                if (max != null) b = max;
                if (a >= b) b = a + 1;
                return scaleLinear().domain([a, b]).nice(c.ticks).domain() as [number, number];
            };
            const order = idx.filter((i) => exts[i][0] != null).sort((a, b) => state(ys[a]).start - state(ys[b]).start);
            let d: [number, number] | null = null;
            for (const i of order) {
                const e = exts[i] as [number, number];
                const w = c.anim.rescale ? state(ys[i]).p : 1;
                if (!d) d = w > 0 ? fit(e) : null;
                else {
                    const to = fit([Math.min(d[0], e[0]), Math.max(d[1], e[1])]);
                    d = [lerp(d[0], to[0], w), lerp(d[1], to[1], w)];
                }
            }
            return d ?? (order.length ? fit(exts[order[0]] as [number, number]) : fit([0, 1]));
        }
        const dL = domain(leftIdx, c.yMin, c.yMax);
        const dR = domain(rightIdx, c.yMin2 ?? null, c.yMax2 ?? null);
        const tickText = (d: [number, number]) => {
            const s = scaleLinear().domain(d);
            const f = s.tickFormat(c.ticks);
            return s.ticks(c.ticks).map((v) => ({ v, text: num(v, f) + pct }));
        };
        const ticksL = dL ? tickText(dL) : [];
        const ticksR = dR ? tickText(dR) : [];

        const barValues = c.barValues ?? (c.endLabels ? "end" : "off");
        // Where series i's bar sits across its category's band: its share of it side by side, or all of it overlaid
        const overlaid = c.barLayout === "overlay" && ys.length > 1;
        const across = (i: number, band: number, inner: (i: number) => number | undefined, share: number) => (overlaid ? { at: 0, w: band } : { at: inner(i)!, w: share });
        // Overlaid bars are drawn after every series, biggest first in each category so none hides another, then their
        // values on top: the biggest bar's past its end, the ones in front inside their own bars.
        const layers: { j: number; size: number; svg: string }[] = [];
        const atop: string[] = [];
        // A value on an overlaid bar: `out` is just past its own end, `inner` inside it (null if it never fits, NaN while
        // the bar is still too short) and `final` inside the finished bar, `ext` how much room it takes along the value
        // axis, `on` its colour inside the bar
        type Placed = { j: number; size: number; out: number; inner: number | null; final: number | null; preferInside: boolean; ext: number; on: string; color: string; svg: (at: number, fill?: string, inside?: boolean) => string };
        const outward: Placed[] = [];
        /** `dir` is the way values grow: -1 up the screen (vertical bars), 1 to the right (horizontal) */
        function overlay(dir: 1 | -1) {
            const bars = layers.sort((a, b) => a.j - b.j || b.size - a.size).map((l) => l.svg);
            const values = [...new Set(outward.map((o) => o.j))].flatMap((j) => {
                const row = outward.filter((o) => o.j === j).sort((a, b) => b.size - a.size);
                const near = (a: Placed, b: Placed) => a.final != null && b.final != null && Math.abs(a.final - b.final) < Math.max(a.ext, b.ext);
                // The biggest bar's value goes where it was asked to, but when the value in front of it would sit right
                // there too, it steps out past its own end and leaves the inside to the front one. Decided from the
                // finished bars, so nothing swaps sides while they grow.
                const [big, front] = row;
                const bigInside = big.preferInside && big.final != null && !(front && near(big, front));
                const kept: Placed[] = bigInside ? [big] : [];
                let edge = NaN; // how far out the last value past the biggest bar reaches
                return row.map((o, k) => {
                    const inside = k === 0 ? bigInside : o.final != null && !kept.some((p) => near(p, o));
                    if (inside) {
                        if (k > 0) kept.push(o);
                        return o.inner == null || Number.isNaN(o.inner) ? "" : o.svg(o.inner, o.on, true); // "" while it grows
                    }
                    // Past the biggest bar's end, each beyond the last
                    const at = Number.isNaN(edge) ? big.out : dir < 0 ? Math.min(big.out, edge) : Math.max(big.out, edge);
                    edge = at + dir * o.ext;
                    return o.svg(at, o.color, false);
                });
            });
            return [...bars, ...atop, ...values];
        }
        // Overlaid parts carry their series' opacity and tag themselves, since they're drawn outside its group
        const own = (op: number, name: string) => (overlaid ? ` opacity="${r2(op)}"${tag(`series:${name}`)}` : "");
        const valueText = (v: number) => num(v, (n) => n.toLocaleString("en-GB", { minimumFractionDigits: c.decimals, maximumFractionDigits: c.decimals })) + pct;
        const lg = placeLegend(ys.map((y, i) => ({ key: y, name: dual && onRight.has(y) ? `${y} (R)` : y, color: seriesColor(c, y, i) })));
        // Margins come from the widest text each side has to hold
        const widest = (texts: string[]) => Math.max(0, ...texts.map((t) => textWidth(t, c)));
        const unitOf = (y: string) => (onRight.has(y) ? (c.unit2 ?? "") : c.unit);
        // Axes draw in (lines grow, or everything fades)
        const ax = state("axes");
        const len = ax.effect === "fade" ? 1 : ax.p;
        const lineOp = ax.effect === "fade" ? ax.p : ax.p > 0 ? 1 : 0;
        const text = esc(c.colors.text);
        if (horiz && dL) return hbars();
        // Right of the plot: end-of-line values next to their lines, then the right axis (tick numbers, then its name)
        const tickW = dR ? widest(ticksR.map((t) => t.text)) + fs * 0.6 : 0;
        const rightW = dR ? tickW + (c.yLabel2 ? fs * 1.8 : 0) + fs * 0.4 : 0;
        // The longest end-of-line value, from each series' extremes
        const endW = c.endLabels && lineish ? widest(ys.flatMap((y, i) => (exts[i][0] == null ? [] : exts[i].map((v) => valueText(v!) + unitOf(y))))) : 0;
        let L = dL ? (c.yLabel ? fs * 2.2 : fs * 0.6) + widest(ticksL.map((t) => t.text)) + fs * 0.6 : fs * 1.5;
        const endCol = endW ? fs * 0.7 + endW + (dR ? fs : fs * 0.6) : fs * 1.5;
        let R = W - endCol - rightW;
        let T = Math.max(lg.height, fs * 0.5) + fs;
        const top0 = T; // values above the bars can use the space down from here
        const B = H - fs * 2.2 - (c.xLabel ? fs * 1.8 : 0);
        // Values above the bars need room over the tallest one: lower the plot's top just enough to fit them.
        // f is how far below the top of its axis the tallest bar ends, as a share of the plot's height.
        if (c.type === "bar" && (barValues === "end" || (barValues === "inside" && c.barLayout === "overlay" && ys.length > 1))) {
            let f = 1;
            ys.forEach((name, i) => {
                const d = onRight.has(name) ? dR : dL;
                if (d) for (const v of vals[i]) if (v != null && v > 0) f = Math.min(f, Math.max(0, (d[1] - v) / (d[1] - d[0])));
            });
            const need = (fs * 1.3 - f * (B - T)) / (1 - f);
            if (f < 1 && need > 0) T += Math.min(need, (B - T) / 2);
        }

        // x: bars get a band per row, categories a point per row, numbers and dates a continuous scale
        function xAxis(L: number, R: number) {
            if (c.type === "bar" || xKind === "category") {
                const idx = rows.map((_, j) => j);
                const s = c.type === "bar" ? scaleBand(idx, [L, R]).padding(0.2) : scalePoint(idx, [L, R]).padding(0.5);
                const band = s.bandwidth();
                const labels = rows.map((r) => label(r[c.x]));
                // Every nth label, so the widest ones don't collide
                const step = Math.max(1, Math.ceil(rows.length / Math.max(1, Math.floor((R - L) / (widest(labels) + fs)))));
                return { band, px: (j: number) => s(j)!, ticks: idx.filter((j) => j % step === 0).map((j) => ({ at: s(j)! + band / 2, text: labels[j] })) };
            }
            if (xKind === "date") {
                const s = scaleTime([rows[0][c.x] as Date, rows.at(-1)![c.x] as Date], [L, R]);
                const span = +s.domain()[1] - +s.domain()[0];
                const day = 864e5;
                const fmt = new Intl.DateTimeFormat("en-GB", span < 6e5 ? { hour: "2-digit", minute: "2-digit", second: "2-digit" } : span < 2 * day ? { hour: "2-digit", minute: "2-digit" } : span < 365 * day ? { day: "numeric", month: "short" } : { month: "short", year: "numeric" });
                return { band: 0, px: (j: number) => s(rows[j][c.x] as Date), ticks: s.ticks(Math.floor((R - L) / (fs * 8))).map((v) => ({ at: s(v), text: fmt.format(v) })) };
            }
            const s = scaleLinear(extent(rows, (r) => r[c.x] as number) as [number, number], [L, R]);
            return { band: 0, px: (j: number) => s(rows[j][c.x] as number), ticks: s.ticks(Math.floor((R - L) / (fs * 6))).map((v) => ({ at: s(v), text: num(v, s.tickFormat()) })) };
        }
        let xa = xAxis(L, R);
        // Centred tick labels at either end can run off the edge: pull the plot in and lay out again
        const first = xa.ticks[0];
        const last = xa.ticks.at(-1);
        const overL = first ? Math.max(0, fs * 0.5 - (first.at - textWidth(first.text, c) / 2)) : 0;
        const overR = last ? Math.max(0, last.at + textWidth(last.text, c) / 2 - (W - fs * 0.5)) : 0;
        if (overL || overR) (L += overL), (R -= overR), (xa = xAxis(L, R));
        const { px, band, ticks: xTicks } = xa;
        // Where the right axis starts: past the end-of-line values, if there are any
        const A = R + (endW ? endCol : 0);

        const yL = dL && scaleLinear(dL, [B, T]);
        const yR = dR && scaleLinear(dR, [B, T]);
        const baseOf = (y: typeof yL, d: typeof dL) => (y && d ? y(Math.min(d[1], Math.max(d[0], 0))) : B);
        const baseL = baseOf(yL, dL);
        const baseR = baseOf(yR, dR);

        // axes (grid lines follow the left axis, or the right one when it's alone)
        const yGrid = yL ?? yR;
        out.push(`<g opacity="${r2(lineOp)}">`);
        // Grid and baseline run under the end values to the right axis, when there is one
        const gx = r2(L + ((yR ? A : R) - L) * len);
        if (c.grid && yGrid) for (const t of yL ? ticksL : ticksR) out.push(`<line x1="${r2(L)}" x2="${gx}" y1="${r2(yGrid(t.v))}" y2="${r2(yGrid(t.v))}" stroke="${esc(c.colors.grid)}"/>`);
        out.push(`<line x1="${r2(L)}" x2="${gx}" y1="${r2(B)}" y2="${r2(B)}" stroke="${esc(c.colors.axis)}" stroke-width="2"/></g>`);
        out.push(`<g opacity="${r2(ax.p)}" fill="${text}">`);
        if (yL) out.push(`<g${tag("y")}>${hit("y", 0, T - fs * 0.5, L - fs * 0.2, B - T + fs)}${ticksL.map((t) => `<text x="${r2(L - fs * 0.6)}" y="${r2(yL(t.v))}" dy="0.35em" text-anchor="end">${esc(t.text)}</text>`).join("")}</g>`);
        if (yR) out.push(`<g${tag("y2")}>${hit("y2", A + fs * 0.2, T - fs * 0.5, rightW - fs * 0.2, B - T + fs)}${ticksR.map((t) => `<text x="${r2(A + fs * 0.6)}" y="${r2(yR(t.v))}" dy="0.35em">${esc(t.text)}</text>`).join("")}</g>`);
        out.push(`<g${tag("x")}>${hit("x", L, B + fs * 0.2, R - L, H - B - fs * 0.2)}${xTicks.map((tk) => `<text x="${r2(tk.at)}" y="${r2(B + fs * 1.5)}" text-anchor="middle">${esc(tk.text)}</text>`).join("")}</g>`);
        if (c.xLabel) out.push(`<text x="${r2((L + R) / 2)}" y="${r2(H - fs * 0.7)}" text-anchor="middle"${tag("xLabel")}>${esc(c.xLabel)}</text>`);
        if (yL && c.yLabel) out.push(`<text transform="translate(${r2(fs * 1.2)} ${r2((T + B) / 2)}) rotate(-90)" text-anchor="middle"${tag("yLabel")}>${esc(c.yLabel)}</text>`);
        if (yR && c.yLabel2) out.push(`<text transform="translate(${r2(A + tickW + fs * 1.2)} ${r2((T + B) / 2)}) rotate(90)" text-anchor="middle"${tag("yLabel2")}>${esc(c.yLabel2)}</text>`);
        out.push(`</g>`);

        // series
        const curve = { linear: curveLinear, smooth: curveMonotoneX, step: curveStepAfter }[c.curve];
        const inner = scaleBand(ys.map((_, i) => i), [0, band]).padding(0.08);
        const ends: EndLabel[] = [];
        ys.forEach((name, i) => {
            const st = state(name);
            if (st.p <= 0) return;
            const right = onRight.has(name);
            const y = (right ? yR : yL)!;
            const base = right ? baseR : baseL;
            const color = esc(seriesColor(c, name, i));
            const op = st.effect === "fade" ? st.p : 1;
            // Lines have no separate points, so "each" draws them like "draw"
            const cut = st.effect === "draw" || (st.effect === "each" && lineish) ? L + (R - L) * st.p : Infinity;
            const grow = (py: number, p = st.effect === "grow" ? st.p : 1) => base + (py - base) * p;
            const g: string[] = [];

            if (c.type === "bar") {
                vals[i].forEach((v, j) => {
                    if (v == null) return;
                    const h = st.effect === "grow" ? st.p : st.effect === "draw" ? clamp01(st.p * rows.length - j) : st.effect === "each" ? each(st, j, rows.length) : 1;
                    const top = base + (y(v) - base) * h;
                    const { at, w: bw } = across(i, band, inner, inner.bandwidth());
                    const bx = px(j) + at;
                    const rect = `<rect x="${r2(bx)}" y="${r2(Math.min(top, base))}" width="${r2(bw)}" height="${r2(Math.abs(top - base))}" fill="${color}"${own(op, name)}/>`;
                    if (overlaid) layers.push({ j, size: Math.abs(v), svg: rect });
                    else g.push(rect);
                    // The value at the bar's end, counting up as it grows, shrunk to fit the bar's width (or left off).
                    // Inside or outside is decided from the finished bar, so the value never jumps between them.
                    if (barValues === "off" || h <= 0) return;
                    const label = valueText(y.invert(top)) + unitOf(name);
                    const end = y(v);
                    const size = Math.min(fs, (fs * bw * 0.95) / textWidth(valueText(v) + unitOf(name), c));
                    if (size < 8) return;
                    const up = end <= base;
                    const fits = Math.abs(end - base) >= size * 1.6;
                    const room = up ? end - top0 >= size * 1.2 : B - end >= size * 1.2;
                    // Inside when asked and it fits, or when there's no room past the end
                    const inside = fits && (barValues === "inside" || !room);
                    if (!inside && !room) return;
                    // Going inside: wait until the growing bar can hold it
                    if (inside && Math.abs(top - base) < size * 1.6) return;
                    const ly = inside ? (up ? top + size * 1.15 : top - size * 0.45) : up ? top - size * 0.45 : top + size * 1.15;
                    const fill = inside ? onBar(c, name, i) : color;
                    const text = (at: number, over = fill) => `<text x="${r2(bx + bw / 2)}" y="${r2(at)}" text-anchor="middle"${size < fs ? ` font-size="${r2(size)}"` : ""} fill="${over}"${own(op, name)}>${esc(label)}</text>`;
                    if (!overlaid) g.push(text(ly));
                    else if (!up) atop.push(text(ly));
                    else outward.push({ j, size: Math.abs(v), out: top - size * 0.45, inner: fits ? (Math.abs(top - base) >= size * 1.6 ? top + size * 1.15 : NaN) : null, final: fits ? end + size * 1.15 : null, preferInside: inside, ext: size * 1.15, on: onBar(c, name, i), color, svg: text });
                });
            } else if (c.type === "scatter") {
                vals[i].forEach((v, j) => {
                    const x = px(j);
                    if (v == null || x > cut) return;
                    const r = c.pointSize * (st.effect === "grow" ? st.p : st.effect === "draw" ? clamp01((cut - x) / (fs * 2)) : st.effect === "each" ? each(st, j, rows.length) : 1);
                    g.push(`<rect x="${r2(x - r)}" y="${r2(y(v) - r)}" width="${r2(r * 2)}" height="${r2(r * 2)}" fill="${color}"/>`);
                });
            } else {
                const pts = clip(vals[i].map((v, j): Pt => [px(j), v == null ? null : grow(y(v))]), cut);
                const defined = (p: Pt) => p[1] != null;
                if (c.type === "area") {
                    const a = area<Pt>().defined(defined).curve(curve).digits(2).x((p) => p[0]).y0(base).y1((p) => p[1]!);
                    g.push(`<path d="${a(pts) ?? ""}" fill="${color}" fill-opacity="0.25"/>`);
                }
                const l = line<Pt>().defined(defined).curve(curve).digits(2).x((p) => p[0]).y((p) => p[1]!);
                const d = l(pts) ?? "";
                g.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="${c.lineWidth}" stroke-linejoin="round"/>`);
                // A wider invisible stroke, so thin lines are easy to click
                if (edit) g.push(`<path d="${d}" fill="none" stroke="transparent" stroke-width="${Math.max(16, c.lineWidth + 10)}"/>`);
                const end = pts.findLast(defined);
                if (c.endLabels && end) {
                    const m = c.lineWidth + 3;
                    g.push(`<rect x="${r2(end[0] - m)}" y="${r2(end[1]! - m)}" width="${m * 2}" height="${m * 2}" fill="${color}"/>`);
                    const text = valueText(y.invert(end[1]!)) + unitOf(name);
                    ends.push({ x: end[0] + fs * 0.7, y: end[1]!, w: textWidth(text, c), text, color, op, name });
                }
            }
            out.push(`<g opacity="${r2(op)}"${tag(`series:${name}`)}>${g.join("")}</g>`);
        });
        if (overlaid) out.push(...overlay(-1));
        for (const e of stack(ends, fs * 1.25, T, B)) out.push(`<text x="${r2(e.x)}" y="${r2(e.y)}" dy="0.35em" fill="${e.color}" opacity="${r2(e.op)}"${tag(`series:${e.name}`)}>${esc(e.text)}</text>`);
        out.push(lg.svg);
        return out.join("");

        /** Bars from the left: categories down the side, values along the bottom */
        function hbars() {
            const labels = rows.map((r) => label(r[c.x]));
            const T = Math.max(lg.height, fs * 0.5) + fs;
            const B = H - fs * 2.2 - (c.yLabel ? fs * 1.8 : 0);
            const L = (c.xLabel ? fs * 2.2 : fs * 0.6) + widest(labels) + fs * 0.6;
            // Room on the right for the last tick (centred) and the value after the longest bar
            const valW = barValues !== "off" ? widest(vals.flatMap((v) => v.flatMap((n) => (n == null ? [] : [valueText(n) + c.unit])))) : 0;
            const R = W - Math.max(fs * 1.5, widest(ticksL.slice(-1).map((t) => t.text)) / 2 + fs * 0.5, valW ? valW + fs * 0.9 : 0);
            const x = scaleLinear(dL!, [L, R]);
            const base = x(Math.min(dL![1], Math.max(dL![0], 0)));
            const band = scaleBand(rows.map((_, j) => j), [T, B]).padding(0.2);
            const inner = scaleBand(ys.map((_, i) => i), [0, band.bandwidth()]).padding(0.08);
            const bw = inner.bandwidth();
            const step = Math.max(1, Math.ceil(rows.length / Math.max(1, Math.floor((B - T) / (fs * 1.3)))));

            out.push(`<g opacity="${r2(lineOp)}">`);
            if (c.grid) for (const t of ticksL) out.push(`<line x1="${r2(x(t.v))}" x2="${r2(x(t.v))}" y1="${r2(B)}" y2="${r2(B - (B - T) * len)}" stroke="${esc(c.colors.grid)}"/>`);
            out.push(`<line x1="${r2(base)}" x2="${r2(base)}" y1="${r2(B)}" y2="${r2(B - (B - T) * len)}" stroke="${esc(c.colors.axis)}" stroke-width="2"/></g>`);
            out.push(`<g opacity="${r2(ax.p)}" fill="${text}">`);
            out.push(`<g${tag("y")}>${hit("y", L, B + fs * 0.2, R - L, H - B - fs * 0.2)}${ticksL.map((t) => `<text x="${r2(x(t.v))}" y="${r2(B + fs * 1.5)}" text-anchor="middle">${esc(t.text)}</text>`).join("")}</g>`);
            out.push(`<g${tag("x")}>${hit("x", 0, T, L - fs * 0.2, B - T)}${labels.map((l, j) => (j % step ? "" : `<text x="${r2(L - fs * 0.6)}" y="${r2(band(j)! + band.bandwidth() / 2)}" dy="0.35em" text-anchor="end">${esc(l)}</text>`)).join("")}</g>`);
            if (c.yLabel) out.push(`<text x="${r2((L + R) / 2)}" y="${r2(H - fs * 0.7)}" text-anchor="middle"${tag("yLabel")}>${esc(c.yLabel)}</text>`);
            if (c.xLabel) out.push(`<text transform="translate(${r2(fs * 1.2)} ${r2((T + B) / 2)}) rotate(-90)" text-anchor="middle"${tag("xLabel")}>${esc(c.xLabel)}</text>`);
            out.push(`</g>`);

            ys.forEach((name, i) => {
                const st = state(name);
                if (st.p <= 0) return;
                const color = esc(seriesColor(c, name, i));
                const g: string[] = [];
                const { at, w: bw } = across(i, band.bandwidth(), inner, inner.bandwidth());
                const op = st.effect === "fade" ? st.p : 1;
                vals[i].forEach((v, j) => {
                    if (v == null) return;
                    const p = st.effect === "grow" ? st.p : st.effect === "draw" ? clamp01(st.p * rows.length - j) : st.effect === "each" ? each(st, j, rows.length) : 1;
                    const end = base + (x(v) - base) * p;
                    const top = band(j)! + at;
                    const rect = `<rect x="${r2(Math.min(end, base))}" y="${r2(top)}" width="${r2(Math.abs(end - base))}" height="${r2(bw)}" fill="${color}"${own(op, name)}/>`;
                    if (overlaid) layers.push({ j, size: Math.abs(v), svg: rect });
                    else g.push(rect);
                    // The value past the bar's end or inside it, counting up as it grows; smaller when bars are thin
                    if (barValues !== "off" && p > 0 && bw >= fs * 0.5) {
                        const neg = end < base;
                        const size = Math.min(fs, bw * 0.9);
                        const label = valueText(x.invert(end)) + c.unit;
                        // Decided from the finished bar; a value going inside waits until the growing bar can hold it
                        const room = (bar: number) => Math.abs(bar - base) >= textWidth(valueText(v) + c.unit, c) * (size / fs) + size;
                        const inside = barValues === "inside" && room(x(v));
                        if (inside && !room(end)) return;
                        const lx = inside ? end + (neg ? size : -size) * 0.4 : end + (neg ? -size : size) * 0.4;
                        const fill = inside ? onBar(c, name, i) : color;
                        const text = (x: number, over = fill, within = inside) => `<text x="${r2(x)}" y="${r2(top + bw / 2)}" dy="0.35em"${neg !== within ? ' text-anchor="end"' : ""}${size < fs ? ` font-size="${r2(size)}"` : ""} fill="${over}"${own(op, name)}>${esc(label)}</text>`;
                        if (!overlaid) g.push(text(lx));
                        else if (neg) atop.push(text(lx));
                        else outward.push({ j, size: Math.abs(v), out: end + size * 0.4, inner: room(x(v)) ? (room(end) ? end - size * 0.4 : NaN) : null, final: room(x(v)) ? x(v) - size * 0.4 : null, preferInside: inside, ext: textWidth(label, c) * (size / fs) + size * 0.6, on: onBar(c, name, i), color, svg: text });
                    }
                });
                out.push(`<g opacity="${r2(op)}"${tag(`series:${name}`)}>${g.join("")}</g>`);
            });
            if (overlaid) out.push(...overlay(1));
            out.push(lg.svg);
            return out.join("");
        }
    }
}
