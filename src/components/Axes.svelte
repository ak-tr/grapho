<!-- Axis names and ranges, then how numbers are written everywhere on the chart -->
<script lang="ts">
    import type { Config } from "../lib/render.ts";

    let { config: c = $bindable() }: { config: Config } = $props();
    const nullable = (key: "yMin" | "yMax" | "yMin2" | "yMax2") => [() => c[key] ?? null, (v: number | null | undefined) => (c[key] = typeof v === "number" ? v : null)] as const;
    const [getMin, setMin] = nullable("yMin");
    const [getMax, setMax] = nullable("yMax");
    const [getMin2, setMin2] = nullable("yMin2");
    const [getMax2, setMax2] = nullable("yMax2");
    const dual = $derived(c.type !== "hbar" && c.type !== "pie" && (c.right ?? []).some((y) => c.ys.includes(y)));
    // Horizontal bars put the categories down the side and the values along the bottom
    const names = $derived(c.type === "hbar" ? { x: "Category axis (side)", y: "Value axis (bottom)" } : { x: "X axis (bottom)", y: dual ? "Left Y axis" : "Y axis" });
</script>

{#if c.type === "pie"}
    <p class="font-mono text-xs text-neutral-500">Pie charts have no axes. The settings below still apply to the values in the key.</p>
{:else}
    <fieldset class="grid gap-3">
        <legend class="section-title">{names.x}</legend>
        <div><label class="label" for="xl">Name</label><input id="xl" class="field" bind:value={c.xLabel} /></div>
    </fieldset>

    <fieldset class="grid grid-cols-2 gap-3">
        <legend class="section-title">{names.y}</legend>
        <div class="col-span-2"><label class="label" for="yl">Name</label><input id="yl" class="field" bind:value={c.yLabel} /></div>
        <div><label class="label" for="ymin">From (blank = auto)</label><input id="ymin" type="number" class="field" bind:value={getMin, setMin} /></div>
        <div><label class="label" for="ymax">To (blank = auto)</label><input id="ymax" type="number" class="field" bind:value={getMax, setMax} /></div>
        <div><label class="label" for="ticks">Number of ticks</label><input id="ticks" type="number" min="2" max="20" class="field" bind:value={c.ticks} /></div>
    </fieldset>

    {#if dual}
        <fieldset class="grid grid-cols-2 gap-3">
            <legend class="section-title">Right Y axis</legend>
            <div class="col-span-2"><label class="label" for="yl2">Name</label><input id="yl2" class="field" bind:value={() => c.yLabel2 ?? "", (v) => (c.yLabel2 = v)} /></div>
            <div><label class="label" for="ymin2">From (blank = auto)</label><input id="ymin2" type="number" class="field" bind:value={getMin2, setMin2} /></div>
            <div><label class="label" for="ymax2">To (blank = auto)</label><input id="ymax2" type="number" class="field" bind:value={getMax2, setMax2} /></div>
        </fieldset>
    {/if}
{/if}

<fieldset class="grid grid-cols-2 gap-3">
    <legend class="section-title">Numbers</legend>
    <div><label class="label" for="unit">{dual ? "Unit, left" : "Unit"}</label><input id="unit" class="field" placeholder="°C" bind:value={c.unit} /></div>
    {#if dual}<div><label class="label" for="unit2">Unit, right</label><input id="unit2" class="field" placeholder="RPM" bind:value={() => c.unit2 ?? "", (v) => (c.unit2 = v)} /></div>{/if}
    <div><label class="label" for="dec">Decimals</label><input id="dec" type="number" min="0" max="6" class="field" bind:value={c.decimals} /></div>
    <label class="col-span-2 flex items-center gap-2.5 font-mono text-xs text-neutral-200"><input type="checkbox" class="check" bind:checked={() => c.compact !== false, (v) => (c.compact = v)} />Shorten large numbers (2.5k, 1.2m)</label>
    <label class="col-span-2 flex items-center gap-2.5 font-mono text-xs text-neutral-200"><input type="checkbox" class="check" bind:checked={() => !!c.percent, (v) => (c.percent = v)} />Values are fractions, show as percent (0.25 → 25%)</label>
</fieldset>
