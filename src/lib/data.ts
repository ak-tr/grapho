import { autoType, dsvFormat } from "d3-dsv";

export type Value = number | Date | string | null;
export type Row = Record<string, Value>;
/** `format` says what was detected, `error` why nothing was. */
export type Table = { columns: string[]; rows: Row[]; format: string; error?: string };
export type Kind = "number" | "date" | "category";

const SEPS = { ",": "comma", "\t": "tab", ";": "semicolon", "|": "pipe" } as const;

/** JSON if it looks like JSON, otherwise delimited text with the separator detected. Numbers and ISO dates are typed. */
export function parse(text: string): Table {
    text = text.trim().replace(/^﻿/, "");
    if (!text) return { columns: [], rows: [], format: "" };
    return /^[[{]/.test(text) ? json(text) : delimited(text);
}

/** The separator that splits the first lines into the same number of fields, the most fields wins. Quoted text is ignored. */
export function separator(text: string): keyof typeof SEPS {
    const lines = text.split(/\r?\n/, 20).filter(Boolean).map((l) => l.replace(/"[^"]*"/g, ""));
    let best: keyof typeof SEPS = ",";
    let most = 0;
    for (const sep of Object.keys(SEPS) as (keyof typeof SEPS)[]) {
        const counts = lines.map((l) => l.split(sep).length - 1);
        const n = counts[0];
        if (n > most && counts.every((c) => c === n)) (best = sep), (most = n);
    }
    if (most) return best;
    // Ragged lines (blank cells at the end, notes): fall back to the header alone
    for (const sep of Object.keys(SEPS) as (keyof typeof SEPS)[]) {
        const n = lines[0].split(sep).length - 1;
        if (n > most) (best = sep), (most = n);
    }
    return best;
}

function delimited(text: string): Table {
    const sep = separator(text);
    const [head = [], ...body] = dsvFormat(sep).parseRows(text);
    return { ...fromRows(head, body, sep !== ","), format: sep === "\t" ? "TSV" : `CSV, ${SEPS[sep]}` };
}

/**
 * A header row plus value rows. Repeated names get a number ("RPM", "RPM 2") so each column stays its own,
 * blank names become "Column 3", and columns with no name and no values (a trailing separator) are dropped.
 */
function fromRows(head: unknown[], body: unknown[][], decimalComma = false) {
    const used = new Set<string>();
    const cols: { name: string; i: number }[] = [];
    head.forEach((h, i) => {
        const base = String(h ?? "").trim();
        if (!base && !body.some((r) => String(r[i] ?? "").trim())) return;
        let name = base || `Column ${i + 1}`;
        for (let n = 2; used.has(name); n++) name = `${base || `Column ${i + 1}`} ${n}`;
        used.add(name);
        cols.push({ name, i });
    });
    return { columns: cols.map((c) => c.name), rows: body.map((r) => Object.fromEntries(cols.map((c) => [c.name, cell(r[c.i], decimalComma)]))) };
}

/**
 * Text gets typed: numbers, and dates in ISO-ish forms including "2026-11-15 17:30:43,237" (space, comma before ms).
 * With `decimalComma` (files not split by commas, e.g. European spreadsheets) "1,5" is 1.5.
 */
function cell(v: unknown, decimalComma = false): Value {
    if (typeof v === "number") return v;
    if (v == null) return null;
    if (typeof v === "object") return JSON.stringify(v);
    let s = String(v).trim();
    if (decimalComma && /^-?\d+,\d+$/.test(s)) s = s.replace(",", ".");
    const dt = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)(?:[.,](\d+))?(Z|[-+]\d{2}:\d{2})?$/);
    if (dt) s = `${dt[1]}T${dt[2]}${dt[3] ? "." + dt[3].slice(0, 3).padEnd(3, "0") : ""}${dt[4] ?? ""}`;
    const t: unknown = autoType({ s }).s;
    return typeof t === "boolean" ? s : Number.isNaN(t) ? null : (t as Value); // keep Value to text, numbers, dates
}

/** An array of objects, an array of arrays with a header row, or either one wrapped in an object (`{ "data": [...] }`). */
function json(text: string): Table {
    let data: unknown;
    try {
        data = JSON.parse(text);
    } catch (e) {
        return { columns: [], rows: [], format: "JSON", error: `Not valid JSON: ${(e as Error).message}` };
    }
    if (!Array.isArray(data) && data && typeof data === "object") data = Object.values(data).find(Array.isArray);
    if (!Array.isArray(data) || !data.length) return { columns: [], rows: [], format: "JSON", error: "Expected a list of rows, e.g. [{ \"x\": 1, \"y\": 2 }]" };

    if (Array.isArray(data[0])) {
        const [head, ...body] = data as unknown[][];
        return { ...fromRows(head, body), format: "JSON, rows of values" };
    }
    const columns = [...new Set(data.flatMap((r) => (r && typeof r === "object" ? Object.keys(r) : [])))];
    const rows = data.map((r) => Object.fromEntries(columns.map((c) => [c, cell((r as Record<string, unknown>)?.[c])])));
    return { columns, rows, format: "JSON" };
}

export function kind(table: Table, column: string): Kind {
    const v = table.rows.find((r) => r[column] != null)?.[column];
    return typeof v === "number" ? "number" : v instanceof Date ? "date" : "category";
}

export const numeric = (table: Table) => table.columns.filter((c) => kind(table, c) === "number");

/** Centred rolling average over `window` points, skipping gaps. 1 = no smoothing. */
export function smooth(values: (number | null)[], window: number): (number | null)[] {
    if (window <= 1) return values;
    const half = Math.floor(window / 2);
    return values.map((v, i) => {
        if (v == null) return null;
        let sum = 0;
        let n = 0;
        for (let j = Math.max(0, i - half); j <= Math.min(values.length - 1, i + half); j++) {
            const w = values[j];
            if (w != null) (sum += w), n++;
        }
        return sum / n;
    });
}

export const label = (v: Value) => (v instanceof Date ? v.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : String(v ?? ""));

/**
 * For long data, where each row is one value for one thing (date, category, name, value).
 * `filterBy` = `filterValue` keeps only matching rows. `splitBy` turns the rows into one row per X value with a column
 * per name, holding that name's `value`.
 */
export type Reshape = { filterBy?: string; filterValue?: string; splitBy?: string; value?: string };

export const unique = (t: Table, column: string) => [...new Set(t.rows.map((r) => label(r[column])))];

export function reshape(t: Table, x: string, r?: Reshape | null): Table {
    let rows = t.rows;
    if (r?.filterBy && t.columns.includes(r.filterBy)) rows = rows.filter((row) => label(row[r.filterBy!]) === r.filterValue);
    const { splitBy: by, value } = r ?? {};
    if (!by || !value || !t.columns.includes(by) || !t.columns.includes(value) || !t.columns.includes(x)) return { ...t, rows };
    const names = unique({ ...t, rows }, by).filter((n) => n !== x);
    const out = new Map<unknown, Row>();
    for (const row of rows) {
        const at = row[x] instanceof Date ? +row[x] : row[x];
        if (!out.has(at)) out.set(at, Object.fromEntries([[x, row[x]], ...names.map((n) => [n, null])]));
        if (label(row[by]) !== x) out.get(at)![label(row[by])] = row[value];
    }
    return { columns: [x, ...names], rows: [...out.values()], format: `${t.format}, split by ${by}` };
}

/**
 * Spots long data: X values repeat and a text column says which series each row belongs to. That column (the one
 * with the most different values) splits the series; a second text column with fewer values filters to its first one.
 */
export function suggest(t: Table, x: string): Reshape | null {
    const xs = unique(t, x).length;
    if (xs === t.rows.length) return null;
    const texts = t.columns.filter((c) => c !== x && kind(t, c) === "category").map((c) => ({ c, n: unique(t, c).length })).filter((s) => s.n > 1).sort((a, b) => b.n - a.n);
    const nums = numeric(t).filter((c) => c !== x && !/^id$/i.test(c));
    if (!texts.length || !nums.length) return null;
    const value = nums.find((c) => /value|percent|share|count|amount|total/i.test(c)) ?? nums[0];
    const filter = texts.find((s, i) => i > 0 && s.n < texts[0].n);
    return { splitBy: texts[0].c, value, ...(filter && { filterBy: filter.c, filterValue: unique(t, filter.c)[0] }) };
}
