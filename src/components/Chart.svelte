<script lang="ts">
    import Select from "./Select.svelte";
    import { FONTS, type ChartType, type Config, type Font } from "../lib/render.ts";

    let { config: c = $bindable() }: { config: Config } = $props();
    const types: ChartType[] = ["line", "area", "bar", "scatter", "pie"];
    const nullable = (key: "yMin" | "yMax" | "yMin2" | "yMax2") => [() => c[key] ?? null, (v: number | null | undefined) => (c[key] = typeof v === "number" ? v : null)] as const;
    const [getMin, setMin] = nullable("yMin");
    const [getMax, setMax] = nullable("yMax");
    const [getMin2, setMin2] = nullable("yMin2");
    const [getMax2, setMax2] = nullable("yMax2");
    const dual = $derived((c.right ?? []).some((y) => c.ys.includes(y)));
</script>

<fieldset>
    <legend class="label">Type</legend>
    <div class="grid grid-cols-5 gap-[2px]">
        {#each types as type}
            <button class="btn px-0 {c.type === type ? 'btn-primary' : ''}" aria-pressed={c.type === type} onclick={() => (c.type = type)}>{type}</button>
        {/each}
    </div>
</fieldset>

{#if c.type !== "pie"}
    <div class="grid grid-cols-2 gap-3">
        <div><label class="label" for="xl">X axis name</label><input id="xl" class="field" bind:value={c.xLabel} /></div>
        <div><label class="label" for="yl">{dual ? "Left Y name" : "Y axis name"}</label><input id="yl" class="field" bind:value={c.yLabel} /></div>
        <div><label class="label" for="ymin">Y min (blank = auto)</label><input id="ymin" type="number" class="field" bind:value={getMin, setMin} /></div>
        <div><label class="label" for="ymax">Y max (blank = auto)</label><input id="ymax" type="number" class="field" bind:value={getMax, setMax} /></div>
        <div><label class="label" for="ticks">Y ticks</label><input id="ticks" type="number" min="2" max="20" class="field" bind:value={c.ticks} /></div>
        <div><label class="label" for="unit">{dual ? "Left unit" : "Value unit"}</label><input id="unit" class="field" placeholder="°C" bind:value={c.unit} /></div>
        <div><label class="label" for="dec">Decimals</label><input id="dec" type="number" min="0" max="6" class="field" bind:value={c.decimals} /></div>
        {#if c.type === "scatter"}
            <div><label class="label" for="pt">Point size</label><input id="pt" type="number" min="1" class="field" bind:value={c.pointSize} /></div>
        {:else if c.type !== "bar"}
            <div><label class="label" for="lw">Line width</label><input id="lw" type="number" min="1" class="field" bind:value={c.lineWidth} /></div>
        {/if}
    </div>
    {#if dual}
        <fieldset class="grid grid-cols-2 gap-3">
            <legend class="label">Right Y axis</legend>
            <div><label class="label" for="yl2">Name</label><input id="yl2" class="field" bind:value={() => c.yLabel2 ?? "", (v) => (c.yLabel2 = v)} /></div>
            <div><label class="label" for="unit2">Unit</label><input id="unit2" class="field" placeholder="RPM" bind:value={() => c.unit2 ?? "", (v) => (c.unit2 = v)} /></div>
            <div><label class="label" for="ymin2">Min (blank = auto)</label><input id="ymin2" type="number" class="field" bind:value={getMin2, setMin2} /></div>
            <div><label class="label" for="ymax2">Max (blank = auto)</label><input id="ymax2" type="number" class="field" bind:value={getMax2, setMax2} /></div>
        </fieldset>
    {/if}
{:else}
    <div><label class="label" for="donut">Hole size ({Math.round(c.donut * 100)}%)</label><input id="donut" type="range" min="0" max="0.9" step="0.05" class="w-full accent-neutral-200" bind:value={c.donut} /></div>
{/if}

<fieldset class="grid gap-2">
    <legend class="label">Show</legend>
    {#each [["legend", "Legend"], ["grid", "Grid lines"], ["endLabels", "Value at end of line"]] as const as [key, name]}
        <label class="flex items-center gap-2.5 font-mono text-xs text-neutral-200"><input type="checkbox" class="check" bind:checked={c[key]} />{name}</label>
    {/each}
</fieldset>

<div>
    <label class="label" for="font">Font</label>
    <Select id="font" bind:value={c.font} options={Object.entries(FONTS).map(([value, f]) => ({ value: value as Font, label: f.name, style: `font-family: ${f.css}` }))} />
</div>

<div class="grid grid-cols-3 gap-3">
    <div><label class="label" for="w">Width</label><input id="w" type="number" min="200" step="10" class="field" bind:value={c.width} /></div>
    <div><label class="label" for="h">Height</label><input id="h" type="number" min="100" step="10" class="field" bind:value={c.height} /></div>
    <div><label class="label" for="fs">Text size</label><input id="fs" type="number" min="8" class="field" bind:value={c.fontSize} /></div>
</div>
