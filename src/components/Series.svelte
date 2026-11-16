<!-- Which columns to plot, each one's colour and axis, then how all of them are drawn -->
<script lang="ts">
    import Select from "./Select.svelte";
    import { numeric, type Table } from "../lib/data.ts";
    import { seriesColor, type Config } from "../lib/render.ts";

    let { config: c = $bindable(), table }: { config: Config; table: Table } = $props();
    const columns = $derived(numeric(table).filter((col) => col !== c.x));
    const lines = $derived(c.type === "line" || c.type === "area");
    const bars = $derived(c.type === "bar" || c.type === "hbar");
    // A right axis only makes sense with an X axis along the bottom
    const sides = $derived(c.type !== "pie" && c.type !== "hbar");

    function toggle(col: string, on: boolean) {
        c.ys = on ? [...c.ys, col] : c.ys.filter((y) => y !== col);
        if (!on) c.right = (c.right ?? []).filter((y) => y !== col);
        c.anim.steps = on
            ? [...c.anim.steps, { target: col, effect: lines ? "draw" : "grow", ms: 1500, ease: "out", together: false }]
            : c.anim.steps.filter((s) => s.target !== col);
    }

    const side = (col: string) => ((c.right ?? []).includes(col) ? "R" : "L");
    const setSide = (col: string, s: "L" | "R") => (c.right = s === "R" ? [...(c.right ?? []).filter((y) => y !== col), col] : (c.right ?? []).filter((y) => y !== col));
</script>

{#if !columns.length}
    <p class="font-mono text-xs text-neutral-500">{table.columns.length ? "No number columns to plot." : "Add data first, in Setup."}</p>
{:else}
    <fieldset>
        <legend class="section-title">Series{sides ? " / colour / axis" : " / colour"}</legend>
        <div class="grid gap-[2px]">
            {#each columns as col}
                {@const on = c.ys.includes(col)}
                <div class="flex items-center gap-3 bg-tile py-1.5 pl-3 pr-1.5">
                    <label class="flex min-w-0 flex-1 items-center gap-2.5 font-mono text-xs text-neutral-200">
                        <input type="checkbox" class="check" checked={on} onchange={(e) => toggle(col, e.currentTarget.checked)} />
                        <span class="truncate">{col}</span>
                    </label>
                    {#if on && c.type !== "pie"}
                        <input type="color" aria-label="Colour of {col}" class="!h-7 !w-10 shrink-0" value={seriesColor(c, col, c.ys.indexOf(col))} oninput={(e) => (c.colors.series[col] = e.currentTarget.value)} />
                        {#if sides}
                            <span class="flex shrink-0 gap-[2px]" role="group" aria-label="Y axis for {col}">
                                {#each ["L", "R"] as const as s}
                                    <button class="btn px-2 py-0.5 text-[11px] {side(col) === s ? 'btn-primary' : ''}" aria-pressed={side(col) === s} title={s === "L" ? "Left Y axis" : "Right Y axis"} onclick={() => setSide(col, s)}>{s}</button>
                                {/each}
                            </span>
                        {/if}
                    {/if}
                </div>
            {/each}
        </div>
        {#if c.type === "pie"}<p class="mt-2 font-mono text-[11px] text-neutral-500">A pie shows the first ticked series, one slice per row. Click a slice on the chart to change its colour.</p>{/if}
        {#if Object.keys(c.colors.series).length && c.type !== "pie"}<button class="btn mt-2" onclick={() => (c.colors.series = {})}>Reset colours</button>{/if}
    </fieldset>

    <fieldset class="grid grid-cols-2 gap-3">
        <legend class="section-title">Drawing</legend>
        {#if lines}
            <div>
                <label class="label" for="curve">Line shape</label>
                <Select id="curve" bind:value={c.curve} options={[{ value: "linear" as const, label: "Straight" }, { value: "smooth" as const, label: "Smooth" }, { value: "step" as const, label: "Steps" }]} />
            </div>
            <div><label class="label" for="lw">Line width</label><input id="lw" type="number" min="1" class="field" bind:value={c.lineWidth} /></div>
        {:else if c.type === "scatter"}
            <div><label class="label" for="pt">Point size</label><input id="pt" type="number" min="1" class="field" bind:value={c.pointSize} /></div>
        {/if}
        {#if c.type !== "pie"}
            <div>
                <label class="label" for="window">Smoothing (1 = off)</label>
                <input id="window" type="number" min="1" step="1" class="field" title="Each point becomes the average of this many points around it" bind:value={c.window} />
            </div>
        {/if}
        {#if bars}
            <div class="col-span-2">
                <label class="label" for="barvals">Value on each bar</label>
                <Select id="barvals" bind:value={() => c.barValues ?? (c.endLabels ? "end" : "off"), (v) => (c.barValues = v)} options={[{ value: "end" as const, label: c.type === "hbar" ? "After the bar" : "Above the bar" }, { value: "inside" as const, label: "Inside, at the end" }, { value: "off" as const, label: "None" }]} />
            </div>
        {:else if lines}
            <label class="col-span-2 flex items-center gap-2.5 font-mono text-xs text-neutral-200"><input type="checkbox" class="check" bind:checked={c.endLabels} />Value at the end of each line</label>
        {:else if c.type === "pie"}
            <div class="col-span-2"><label class="label" for="donut">Hole in the middle ({Math.round(c.donut * 100)}%)</label><input id="donut" type="range" min="0" max="0.9" step="0.05" class="w-full accent-neutral-200" bind:value={c.donut} /></div>
        {/if}
    </fieldset>
{/if}
