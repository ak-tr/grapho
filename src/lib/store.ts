import { numeric, parse, reshape, suggest, unique } from "./data.ts";
import { defaults, defaultSteps, type Config } from "./render.ts";

/** `csv` holds the raw data text as given: any delimited text or JSON (the name predates JSON support). */
export type Doc = { id: string; name: string; csv: string; config: Config; updated: number };

/** A list kept in localStorage under `key`, newest first, one entry per `id` */
function stored<T>(key: string, id: (item: T) => string) {
    const list = (): T[] => {
        try {
            return JSON.parse(localStorage.getItem(key) ?? "[]");
        } catch {
            return [];
        }
    };
    const save = (items: T[]) => localStorage.setItem(key, JSON.stringify(items));
    return { list, put: (item: T) => save([item, ...list().filter((x) => id(x) !== id(item))]), remove: (k: string) => save(list().filter((x) => id(x) !== k)) };
}

// ponytail: localStorage only (about 5 MB, this browser only), move to D1 + accounts for cross-device saving
const charts = stored<Doc>("grapho:charts", (d) => d.id);
export const { list, remove } = charts;

/** Only charts with data are worth keeping. Throws if storage is full, so the caller can say so. */
export function put(doc: Doc) {
    if (doc.csv.trim()) charts.put({ ...doc, updated: Date.now() });
}

export function fresh(): Doc {
    return { id: crypto.randomUUID(), name: "Untitled chart", csv: "", config: defaults(parse("")), updated: Date.now() };
}

/** New data: pick sensible columns again (splitting long data into series), keep the styling. */
export function load(doc: Doc, csv: string) {
    doc.csv = csv;
    const raw = parse(csv);
    const d = defaults(raw);
    let r = suggest(raw, d.x);
    // A single date: the names go along the X axis instead (one bar or slice each), still filtered
    if (r && unique(raw, d.x).length === 1) Object.assign(d, { x: r.splitBy, xLabel: r.splitBy, ys: [r.value], yLabel: r.value }), (r = { filterBy: r.filterBy, filterValue: r.filterValue });
    else if (r) Object.assign(d, { ys: series(numeric(reshape(raw, d.x, r)), d.x), yLabel: r.value });
    Object.assign(doc.config, { x: d.x, ys: d.ys, reshape: r, percent: false, xLabel: d.xLabel, yLabel: d.yLabel, unit: "", right: [], yLabel2: "", unit2: "", colors: { ...doc.config.colors, series: {} } });
    doc.config.anim.steps = defaultSteps({ ys: d.ys, type: doc.config.type });
}

/** Up to eight series from split columns (one colour each before the palette repeats) */
export const series = (columns: string[], x: string) => columns.filter((c) => c !== x).slice(0, 8);

/** A colour way saved by the user, shared by all their charts. `series` is the line colours in order, if they picked any. */
export type Colourway = { name: string; colors: { background: string; text: string; axis: string; grid: string }; series?: string[] };
/** Saving under a name that's taken replaces it */
export const { list: colourways, put: putColourway, remove: removeColourway } = stored<Colourway>("grapho:colourways", (w) => w.name);
