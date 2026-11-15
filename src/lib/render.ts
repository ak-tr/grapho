import { extent } from "d3-array";
import { scaleBand, scaleLinear, scalePoint, scaleTime } from "d3-scale";
import { arc, area, curveLinear, curveMonotoneX, curveStepAfter, line, pie } from "d3-shape";
import { kind, label, numeric, smooth, type Table } from "./data.ts";
import { at, type Animation, type Step } from "./timeline.ts";

export type ChartType = "line" | "area" | "bar" | "scatter" | "pie";
export type Curve = "linear" | "smooth" | "step";

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
    legend: boolean;
    endLabels: boolean;
    grid: boolean;
    lineWidth: number;
    pointSize: number;
    donut: number;
    width: number;
    height: number;
    fontSize: number;
    font: Font;
    colors: { background: string; transparent: boolean; text: string; axis: string; grid: string; series: Record<string, string> };
    anim: Animation;
};

// Pastels read on dark backgrounds, deeper colours on light ones. Picked from the background, so presets just work.
const ON_DARK = ["#8dd3c7", "#feffb3", "#bebada", "#fa8072", "#80b1d3", "#fdb462", "#b3de69", "#fccde5"];
const ON_LIGHT = ["#1b9e77", "#d95f02", "#7570b3", "#e7298a", "#66a61e", "#c49a00", "#a6761d", "#666666"];

export function palette(c: Config) {
    const n = parseInt(c.colors.background.slice(1), 16);
    const light = !c.colors.transparent && 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 140;
    return light ? ON_LIGHT : ON_DARK;
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
        unit: "", decimals: 1, legend: true, endLabels: true, grid: true,
        lineWidth: 3, pointSize: 5, donut: 0.5,
        width: 1200, height: 600, fontSize: 18, font: "geist-mono",
        colors: { background: "#111111", transparent: false, text: "#a3a3a3", axis: "#525252", grid: "#262626", series: {} },
        anim: { steps: defaultSteps({ ys, type: "line" }), hold: 1500, rescale: false, fps: 30, gifFps: 25 },
    };
}

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

type EndLabel = { x: number; y: number; w: number; text: string; color: string; op: number };

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

type LegendItem = { name: string; color: string; opacity: number };

function legend(items: LegendItem[], c: Config) {
    const fs = c.fontSize;
    const pad = fs * 1.2;
    let x = pad;
    let y = fs * 1.6;
    const parts = items.map((it) => {
        const w = textWidth(it.name, c) + fs * 2.4;
        if (x + w > c.width - pad && x > pad) (x = pad), (y += fs * 1.6);
        const s = `<g opacity="${r2(it.opacity)}"><rect x="${r2(x)}" y="${r2(y - fs * 0.75)}" width="${r2(fs * 0.8)}" height="${r2(fs * 0.8)}" fill="${esc(it.color)}"/><text x="${r2(x + fs * 1.3)}" y="${r2(y)}" fill="${esc(c.colors.text)}">${esc(it.name)}</text></g>`;
        x += w;
        return s;
    });
    return { svg: parts.join(""), height: y + fs * 0.6 };
}

/** The whole chart at time `t` (ms) as an SVG string. Pure: playback, scrubbing and export all call this. */
export function render(table: Table, c: Config, t: number, fontCss = ""): string {
    const { width: W, height: H, fontSize: fs } = c;
    const state = at(c.anim, t);
    const ys = c.ys.filter((y) => table.columns.includes(y));
    const xKind = kind(table, c.x);
    let rows = table.rows.filter((r) => r[c.x] != null);
    if (xKind !== "category" && c.type !== "pie") rows = [...rows].sort((a, b) => +a[c.x]! - +b[c.x]!);
    const vals = ys.map((y) => smooth(rows.map((r) => (typeof r[y] === "number" ? (r[y] as number) : null)), c.window));
    const body = c.type === "pie" ? pieChart() : cartesian();
    const bg = c.colors.transparent ? "" : `<rect width="${W}" height="${H}" fill="${esc(c.colors.background)}"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${(FONTS[c.font] ?? FONTS["geist-mono"]).css}" font-size="${fs}">${fontCss && `<style>${fontCss}</style>`}${bg}${body}</svg>`;

    function pieChart() {
        const y = ys[0];
        if (!y) return "";
        const st = state(y);
        const slices = rows.map((r, j) => ({ name: label(r[c.x]), value: Math.max(0, vals[0][j] ?? 0), color: palette(c)[j % 8] }));
        const lg = c.legend ? legend(slices.map((s) => ({ ...s, opacity: Math.min(1, st.p * 3) })), c) : { svg: "", height: 0 };
        const top = lg.height + fs;
        const radius = Math.max(0, Math.min(W, H - top) / 2 - fs) * (st.effect === "grow" ? st.p : 1);
        const limit = st.effect === "draw" ? st.p * Math.PI * 2 : Infinity;
        const shape = arc<{ startAngle: number; endAngle: number }>().innerRadius(radius * c.donut).outerRadius(radius).digits(2);
        const paths = pie<(typeof slices)[number]>().value((s) => s.value).sortValues(null)(slices)
            .filter((a) => a.startAngle < limit)
            .map((a) => `<path d="${shape({ startAngle: a.startAngle, endAngle: Math.min(a.endAngle, limit) })}" fill="${esc(a.data.color)}" stroke="${esc(c.colors.transparent ? "none" : c.colors.background)}" stroke-width="2"/>`);
        const op = st.effect === "fade" ? st.p : st.p > 0 ? 1 : 0;
        return `${lg.svg}<g transform="translate(${r2(W / 2)} ${r2((top + H) / 2)})" opacity="${r2(op)}">${paths.join("")}</g>`;
    }

    function cartesian() {
        const out: string[] = [];
        const lineish = c.type === "line" || c.type === "area";
        const onRight = new Set((c.right ?? []).filter((y) => ys.includes(y)));
        const all = ys.map((_, i) => i);
        const leftIdx = all.filter((i) => !onRight.has(ys[i]));
        const rightIdx = all.filter((i) => onRight.has(ys[i]));
        const dual = leftIdx.length > 0 && rightIdx.length > 0;

        // y: one domain per axis, optionally growing to fit each series as it comes in
        const exts = vals.map((v) => extent(v.filter((n): n is number => n != null)) as [number, number] | [undefined, undefined]);
        function domain(idx: number[], min: number | null, max: number | null): [number, number] | null {
            if (!idx.length) return null;
            const fit = ([a, b]: [number, number]): [number, number] => {
                if (c.type === "bar" || c.type === "area") (a = Math.min(0, a)), (b = Math.max(0, b));
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
            return s.ticks(c.ticks).map((v) => ({ v, text: compact(v, f) }));
        };
        const ticksL = dL ? tickText(dL) : [];
        const ticksR = dR ? tickText(dR) : [];

        const valueText = (v: number) => compact(v, (n) => n.toFixed(c.decimals));
        const lg = c.legend && ys.length ? legend(ys.map((y, i) => ({ name: dual && onRight.has(y) ? `${y} (R)` : y, color: seriesColor(c, y, i), opacity: Math.min(1, state(y).p * 4) })), c) : { svg: "", height: 0 };
        out.push(lg.svg);
        // Margins come from the widest text each side has to hold
        const widest = (texts: string[]) => Math.max(0, ...texts.map((t) => textWidth(t, c)));
        const unitOf = (y: string) => (onRight.has(y) ? (c.unit2 ?? "") : c.unit);
        // Right axis: tick numbers, then its name; end-of-line values sit in a column after both
        const tickW = dR ? widest(ticksR.map((t) => t.text)) + fs * 0.6 : 0;
        const rightW = dR ? tickW + (c.yLabel2 ? fs * 1.8 : 0) + fs * 0.4 : 0;
        // The longest end-of-line value, from each series' extremes
        const endW = c.endLabels && lineish ? widest(ys.flatMap((y, i) => (exts[i][0] == null ? [] : exts[i].map((v) => valueText(v!) + unitOf(y))))) : 0;
        let L = dL ? (c.yLabel ? fs * 2.2 : fs * 0.6) + widest(ticksL.map((t) => t.text)) + fs * 0.6 : fs * 1.5;
        let R = W - (endW ? endW + (dR ? fs * 0.4 : fs * 0.7) + fs * 0.6 : fs * 1.5) - rightW;
        const T = Math.max(lg.height, fs * 0.5) + fs;
        const B = H - fs * 2.2 - (c.xLabel ? fs * 1.8 : 0);

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
            return { band: 0, px: (j: number) => s(rows[j][c.x] as number), ticks: s.ticks(Math.floor((R - L) / (fs * 6))).map((v) => ({ at: s(v), text: compact(v, s.tickFormat()) })) };
        }
        let xa = xAxis(L, R);
        // Centred tick labels at either end can run off the edge: pull the plot in and lay out again
        const first = xa.ticks[0];
        const last = xa.ticks.at(-1);
        const overL = first ? Math.max(0, fs * 0.5 - (first.at - textWidth(first.text, c) / 2)) : 0;
        const overR = last ? Math.max(0, last.at + textWidth(last.text, c) / 2 - (W - fs * 0.5)) : 0;
        if (overL || overR) (L += overL), (R -= overR), (xa = xAxis(L, R));
        const { px, band, ticks: xTicks } = xa;

        const yL = dL && scaleLinear(dL, [B, T]);
        const yR = dR && scaleLinear(dR, [B, T]);
        const baseOf = (y: typeof yL, d: typeof dL) => (y && d ? y(Math.min(d[1], Math.max(d[0], 0))) : B);
        const baseL = baseOf(yL, dL);
        const baseR = baseOf(yR, dR);

        // axes (grid lines follow the left axis, or the right one when it's alone)
        const ax = state("axes");
        const len = ax.effect === "fade" ? 1 : ax.p;
        const lineOp = ax.effect === "fade" ? ax.p : ax.p > 0 ? 1 : 0;
        const text = esc(c.colors.text);
        const yGrid = yL ?? yR;
        out.push(`<g opacity="${r2(lineOp)}">`);
        if (c.grid && yGrid) for (const t of yL ? ticksL : ticksR) out.push(`<line x1="${r2(L)}" x2="${r2(L + (R - L) * len)}" y1="${r2(yGrid(t.v))}" y2="${r2(yGrid(t.v))}" stroke="${esc(c.colors.grid)}"/>`);
        out.push(`<line x1="${r2(L)}" x2="${r2(L + (R - L) * len)}" y1="${r2(B)}" y2="${r2(B)}" stroke="${esc(c.colors.axis)}" stroke-width="2"/></g>`);
        out.push(`<g opacity="${r2(ax.p)}" fill="${text}">`);
        if (yL) for (const t of ticksL) out.push(`<text x="${r2(L - fs * 0.6)}" y="${r2(yL(t.v))}" dy="0.35em" text-anchor="end">${esc(t.text)}</text>`);
        if (yR) for (const t of ticksR) out.push(`<text x="${r2(R + fs * 0.6)}" y="${r2(yR(t.v))}" dy="0.35em">${esc(t.text)}</text>`);
        for (const tk of xTicks) out.push(`<text x="${r2(tk.at)}" y="${r2(B + fs * 1.5)}" text-anchor="middle">${esc(tk.text)}</text>`);
        if (c.xLabel) out.push(`<text x="${r2((L + R) / 2)}" y="${r2(H - fs * 0.7)}" text-anchor="middle">${esc(c.xLabel)}</text>`);
        if (yL && c.yLabel) out.push(`<text transform="translate(${r2(fs * 1.2)} ${r2((T + B) / 2)}) rotate(-90)" text-anchor="middle">${esc(c.yLabel)}</text>`);
        if (yR && c.yLabel2) out.push(`<text transform="translate(${r2(R + tickW + fs * 1.2)} ${r2((T + B) / 2)}) rotate(90)" text-anchor="middle">${esc(c.yLabel2)}</text>`);
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
            const cut = st.effect === "draw" ? L + (R - L) * st.p : Infinity;
            const grow = (py: number, p = st.effect === "grow" ? st.p : 1) => base + (py - base) * p;
            const g: string[] = [];

            if (c.type === "bar") {
                vals[i].forEach((v, j) => {
                    if (v == null) return;
                    const h = st.effect === "grow" ? st.p : st.effect === "draw" ? clamp01(st.p * rows.length - j) : 1;
                    const top = base + (y(v) - base) * h;
                    g.push(`<rect x="${r2(px(j) + inner(i)!)}" y="${r2(Math.min(top, base))}" width="${r2(inner.bandwidth())}" height="${r2(Math.abs(top - base))}" fill="${color}"/>`);
                });
            } else if (c.type === "scatter") {
                vals[i].forEach((v, j) => {
                    const x = px(j);
                    if (v == null || x > cut) return;
                    const r = c.pointSize * (st.effect === "grow" ? st.p : st.effect === "draw" ? clamp01((cut - x) / (fs * 2)) : 1);
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
                g.push(`<path d="${l(pts) ?? ""}" fill="none" stroke="${color}" stroke-width="${c.lineWidth}" stroke-linejoin="round"/>`);
                const end = pts.findLast(defined);
                if (c.endLabels && end) {
                    const m = c.lineWidth + 3;
                    g.push(`<rect x="${r2(end[0] - m)}" y="${r2(end[1]! - m)}" width="${m * 2}" height="${m * 2}" fill="${color}"/>`);
                    const text = valueText(y.invert(end[1]!)) + unitOf(name);
                    ends.push({ x: dR ? R + rightW + fs * 0.4 : end[0] + fs * 0.7, y: end[1]!, w: textWidth(text, c), text, color, op });
                }
            }
            out.push(`<g opacity="${r2(op)}">${g.join("")}</g>`);
        });
        for (const e of stack(ends, fs * 1.25, T, B)) out.push(`<text x="${r2(e.x)}" y="${r2(e.y)}" dy="0.35em" fill="${e.color}" opacity="${r2(e.op)}">${esc(e.text)}</text>`);
        return out.join("");
    }
}
