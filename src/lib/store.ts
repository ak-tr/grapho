import { parse } from "./data.ts";
import { defaults, defaultSteps, type Config } from "./render.ts";

/** `csv` holds the raw data text as given: any delimited text or JSON (the name predates JSON support). */
export type Doc = { id: string; name: string; csv: string; config: Config; updated: number };

// ponytail: localStorage only (about 5 MB, this browser only), move to D1 + accounts for cross-device saving
const KEY = "grapho:charts";

export function list(): Doc[] {
    try {
        return JSON.parse(localStorage.getItem(KEY) ?? "[]");
    } catch {
        return [];
    }
}

/** Only charts with data are worth keeping. Throws if storage is full, so the caller can say so. */
export function put(doc: Doc) {
    if (!doc.csv.trim()) return;
    localStorage.setItem(KEY, JSON.stringify([{ ...doc, updated: Date.now() }, ...list().filter((d) => d.id !== doc.id)]));
}

export function remove(id: string) {
    localStorage.setItem(KEY, JSON.stringify(list().filter((d) => d.id !== id)));
}

export function fresh(): Doc {
    return { id: crypto.randomUUID(), name: "Untitled chart", csv: "", config: defaults(parse("")), updated: Date.now() };
}

/** New data: pick sensible columns again, keep the styling. */
export function load(doc: Doc, csv: string) {
    doc.csv = csv;
    const d = defaults(parse(csv));
    Object.assign(doc.config, { x: d.x, ys: d.ys, xLabel: d.xLabel, yLabel: d.yLabel, unit: "", right: [], yLabel2: "", unit2: "", colors: { ...doc.config.colors, series: {} } });
    doc.config.anim.steps = defaultSteps({ ys: d.ys, type: doc.config.type });
}
