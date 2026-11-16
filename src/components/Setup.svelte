<script lang="ts">
    import Select from "./Select.svelte";
    import { kind, numeric, reshape, unique, type Reshape, type Table } from "../lib/data.ts";
    import { defaultSteps, TYPE_NAMES, type ChartType } from "../lib/render.ts";
    import { load as loadInto, series, type Doc } from "../lib/store.ts";

    /** `raw` is the data as parsed, `table` after filtering and splitting */
    let { doc = $bindable(), raw, table }: { doc: Doc; raw: Table; table: Table } = $props();
    const c = $derived(doc.config);
    const load = (csv: string) => loadInto(doc, csv);

    async function file(e: Event & { currentTarget: HTMLInputElement }) {
        const f = e.currentTarget.files?.[0];
        if (!f) return;
        load(await f.text());
        if (doc.name === "Untitled chart") doc.name = f.name.replace(/\.\w+$/, "");
    }

    /** Pasting over everything counts as new data; pasting into part of it is just an edit. */
    function paste(e: ClipboardEvent & { currentTarget: HTMLTextAreaElement }) {
        const el = e.currentTarget;
        if (el.selectionStart !== 0 || el.selectionEnd !== el.value.length) return;
        e.preventDefault();
        load(e.clipboardData?.getData("text") ?? "");
    }

    const types = Object.entries(TYPE_NAMES) as [ChartType, string][];

    // Long data: the text columns can filter rows or split them into series
    const texts = $derived(raw.columns.filter((col) => col !== c.x && kind(raw, col) === "category"));
    const r = $derived(c.reshape ?? {});
    function shape(patch: Reshape) {
        const next = { ...r, ...patch };
        if (patch.filterBy !== undefined) next.filterValue = patch.filterBy ? unique(raw, patch.filterBy)[0] : undefined;
        if (patch.splitBy && !next.value) next.value = numeric(raw).find((col) => col !== c.x);
        c.reshape = next;
        // Splitting (or not) changes what the series are: pick them again
        if ("splitBy" in patch || "value" in patch || (next.splitBy && "filterBy" in patch) || (next.splitBy && "filterValue" in patch)) {
            const cols = numeric(reshape(raw, c.x, next));
            c.ys = next.splitBy ? series(cols, c.x) : cols.filter((col) => col !== c.x).slice(0, 4);
            c.right = [];
            c.anim.steps = defaultSteps(c);
            if (next.splitBy && next.value) c.yLabel = next.value;
        }
    }
</script>

<div>
    <label class="label" for="file">Import CSV, TSV or JSON</label>
    <input id="file" type="file" accept=".csv,.tsv,.tab,.psv,.txt,.dat,.json,text/csv,text/tab-separated-values,text/plain,application/json" onchange={file} class="field file:mr-3 file:border-0 file:bg-invert file:px-2 file:py-1 file:font-mono file:text-[11px] file:uppercase file:text-black" />
    <p class="mt-1.5 font-mono text-[11px] text-neutral-500">Separators (comma, tab, semicolon, pipe) are detected. JSON can be a list of objects or a list of rows with a header row first.</p>
</div>

<div>
    <label class="label" for="csv">{doc.csv.trim() ? "Edit, or paste over to replace" : "Or paste it here"}{table.format ? ` (${table.format} / ${table.rows.length} rows)` : ""}</label>
    <textarea id="csv" rows="8" spellcheck="false" bind:value={doc.csv} onpaste={paste} class="field resize-y whitespace-pre leading-relaxed"></textarea>
    {#if table.error}<p class="mt-2 border border-dashed border-neutral-700 p-3 font-mono text-xs text-neutral-300" role="alert">{table.error}</p>{/if}
</div>

{#if raw.columns.length}
<!-- What kind of chart the data makes; the rest of the tabs follow from it -->
<fieldset>
    <legend class="label">Chart type</legend>
    <div class="grid grid-cols-3 gap-[2px]">
        {#each types as [type, name]}
            <button class="btn px-0 {c.type === type ? 'btn-primary' : ''}" aria-pressed={c.type === type} onclick={() => (c.type = type)}>{name}</button>
        {/each}
    </div>
</fieldset>

<div>
    <label class="label" for="x">{c.type === "hbar" || c.type === "pie" ? "Category column" : "X axis column"}</label>
    <Select id="x" bind:value={c.x} options={raw.columns.map((col) => ({ value: col, label: `${col} (${kind(raw, col)})` }))} />
</div>

{#if texts.length}
    <fieldset class="grid grid-cols-2 gap-3">
        <legend class="section-title">One row per value? Split it</legend>
        <p class="col-span-2 -mt-1 font-mono text-[11px] text-neutral-500">For data like date, name, value: one series per name.</p>
        <div>
            <label class="label" for="split">One series per</label>
            <Select id="split" options={[{ value: "", label: "Don't split" }, ...texts.map((col) => ({ value: col, label: col }))]} bind:value={() => r.splitBy ?? "", (v) => shape({ splitBy: v || undefined })} />
        </div>
        {#if r.splitBy}
            <div>
                <label class="label" for="plot">Plotting the</label>
                <Select id="plot" options={numeric(raw).filter((col) => col !== c.x).map((col) => ({ value: col, label: col }))} bind:value={() => r.value ?? "", (v) => shape({ value: v })} />
            </div>
        {/if}
        <div>
            <label class="label" for="fby">Only rows where</label>
            <Select id="fby" options={[{ value: "", label: "All rows" }, ...texts.filter((col) => col !== r.splitBy).map((col) => ({ value: col, label: col }))]} bind:value={() => r.filterBy ?? "", (v) => shape({ filterBy: v || undefined })} />
        </div>
        {#if r.filterBy}
            <div>
                <label class="label" for="fval">is</label>
                <Select id="fval" options={unique(raw, r.filterBy).map((v) => ({ value: v, label: v }))} bind:value={() => r.filterValue ?? "", (v) => shape({ filterValue: v })} />
            </div>
        {/if}
        {#if r.splitBy}<p class="col-span-2 font-mono text-[11px] text-neutral-500">Pick which ones to show in Series.</p>{/if}
    </fieldset>
{/if}
{/if}
