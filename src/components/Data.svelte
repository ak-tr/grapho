<script lang="ts">
    import Select from "./Select.svelte";
    import { kind, numeric, type Table } from "../lib/data.ts";
    import { load as loadInto, type Doc } from "../lib/store.ts";

    let { doc = $bindable(), table }: { doc: Doc; table: Table } = $props();
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

    function toggle(col: string, on: boolean) {
        c.ys = on ? [...c.ys, col] : c.ys.filter((y) => y !== col);
        if (!on) c.right = (c.right ?? []).filter((y) => y !== col);
        c.anim.steps = on
            ? [...c.anim.steps, { target: col, effect: c.type === "line" || c.type === "area" ? "draw" : "grow", ms: 1500, ease: "out", together: false }]
            : c.anim.steps.filter((s) => s.target !== col);
    }

    const side = (col: string) => ((c.right ?? []).includes(col) ? "R" : "L");
    const setSide = (col: string, s: "L" | "R") => (c.right = s === "R" ? [...(c.right ?? []).filter((y) => y !== col), col] : (c.right ?? []).filter((y) => y !== col));
</script>

<div>
    <label class="label" for="file">Import CSV, TSV or JSON</label>
    <input id="file" type="file" accept=".csv,.tsv,.tab,.psv,.txt,.dat,.json,text/csv,text/tab-separated-values,text/plain,application/json" onchange={file} class="field file:mr-3 file:border-0 file:bg-invert file:px-2 file:py-1 file:font-mono file:text-[11px] file:uppercase file:text-black" />
    <p class="mt-1.5 font-mono text-[11px] text-neutral-500">Separators (comma, tab, semicolon, pipe) are detected. JSON can be a list of objects or a list of rows with a header row first.</p>
</div>

<div>
    <label class="label" for="csv">Or paste over / edit{table.format ? ` (${table.format} / ${table.rows.length} rows)` : ""}</label>
    <textarea id="csv" rows="8" spellcheck="false" bind:value={doc.csv} onpaste={paste} class="field resize-y whitespace-pre leading-relaxed"></textarea>
    {#if table.error}<p class="mt-2 border border-dashed border-neutral-700 p-3 font-mono text-xs text-neutral-300" role="alert">{table.error}</p>{/if}
</div>

<div>
    <label class="label" for="x">X axis column</label>
    <Select id="x" bind:value={c.x} options={table.columns.map((col) => ({ value: col, label: `${col} (${kind(table, col)})` }))} />
</div>

<fieldset>
    <legend class="label">Values to show / Y axis</legend>
    <div class="grid gap-2">
        {#each numeric(table).filter((col) => col !== c.x) as col}
            <div class="flex items-center justify-between gap-3">
                <label class="flex min-w-0 items-center gap-2.5 font-mono text-xs text-neutral-200">
                    <input type="checkbox" class="check" checked={c.ys.includes(col)} onchange={(e) => toggle(col, e.currentTarget.checked)} />
                    <span class="truncate">{col}</span>
                </label>
                {#if c.ys.includes(col) && c.type !== "pie"}
                    <span class="flex shrink-0 gap-[2px]" role="group" aria-label="Y axis for {col}">
                        {#each ["L", "R"] as const as s}
                            <button class="btn px-2 py-0.5 text-[11px] {side(col) === s ? 'btn-primary' : ''}" aria-pressed={side(col) === s} title={s === "L" ? "Left Y axis" : "Right Y axis"} onclick={() => setSide(col, s)}>{s}</button>
                        {/each}
                    </span>
                {/if}
            </div>
        {:else}
            <p class="font-mono text-xs text-neutral-500">No number columns found.</p>
        {/each}
    </div>
    {#if c.type === "pie" && c.ys.length > 1}<p class="mt-2 font-mono text-[11px] text-neutral-500">Pie charts show the first value only.</p>{/if}
</fieldset>

<div class="grid grid-cols-2 gap-3">
    <div>
        <label class="label" for="curve">Line shape</label>
        <Select id="curve" bind:value={c.curve} options={[{ value: "linear" as const, label: "Straight" }, { value: "smooth" as const, label: "Smooth" }, { value: "step" as const, label: "Step" }]} />
    </div>
    <div>
        <label class="label" for="window">Average over (points)</label>
        <input id="window" type="number" min="1" step="1" class="field" bind:value={c.window} />
    </div>
</div>
