<script lang="ts">
    import { seriesColor, type Config } from "../lib/render.ts";
    import { colourways, putColourway, removeColourway, type Colourway } from "../lib/store.ts";

    import mosaic from "mosaic/tokens.json";

    let { config: c = $bindable() }: { config: Config } = $props();

    // Colour ways from the Mosaic themes: chart on a tile, mid-grey text, quiet axis and grid
    const presets: Colourway[] = mosaic.themes.map((th) => ({
        name: th.name,
        colors: { background: th.colors.tile, text: th.colors["n-400"], axis: th.colors["n-600"], grid: th.colors["n-800"] },
    }));
    let saved = $state(colourways());
    const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
    const isOn = (p: Colourway) =>
        !c.colors.transparent &&
        Object.entries(p.colors).every(([k, v]) => same(c.colors[k as keyof Colourway["colors"]], v)) &&
        (p.series ?? []).every((col, i) => !c.ys[i] || same(seriesColor(c, c.ys[i], i), col));
    // Unsaved: no colour way matches, or line colours were picked and no saved way has them
    const picked = $derived(c.ys.some((y) => c.colors.series[y]));
    const custom = $derived(![...presets, ...saved].some((p) => isOn(p) && (p.series || !picked)));

    function apply(p: Colourway) {
        Object.assign(c.colors, p.colors, { transparent: false });
        // Saved line colours go onto this chart's series in order; ways without them keep the lines as they are
        if (p.series?.length) c.colors.series = Object.fromEntries(c.ys.map((y, i) => [y, p.series![i % p.series!.length]]));
    }

    let name = $state("");
    function save(e: SubmitEvent) {
        e.preventDefault();
        const { background, text, axis, grid } = c.colors;
        putColourway({ name: name.trim(), colors: { background, text, axis, grid }, ...(picked && { series: c.ys.map((y, i) => seriesColor(c, y, i)) }) });
        saved = colourways();
        name = "";
    }

    function del(n: string) {
        removeColourway(n);
        saved = colourways();
    }
</script>

{#snippet way(p: Colourway)}
    <button
        class="flex min-w-0 flex-1 items-center gap-3 border p-2 text-left font-mono text-[11px] uppercase outline-none focus-visible:border-white can-hover:hover:border-neutral-400 {isOn(p) ? 'border-white text-white' : 'border-neutral-800 text-neutral-400'}"
        aria-pressed={isOn(p)}
        onclick={() => apply(p)}
    >
        <span class="flex h-6 w-16 shrink-0 items-end gap-[3px] p-1" style:background={p.colors.background} style:outline="1px solid {p.colors.grid}">
            <span class="h-1/2 w-full" style:background={p.colors.text}></span>
            <span class="h-full w-full" style:background={p.colors.axis}></span>
            <span class="h-1/3 w-full" style:background={p.colors.grid}></span>
            {#each (p.series ?? []).slice(0, 3) as col}<span class="h-2/3 w-full" style:background={col}></span>{/each}
        </span>
        <span class="truncate">{p.name}</span>
    </button>
{/snippet}

<fieldset>
    <legend class="section-title">Colours / Mosaic colour ways</legend>
    <div class="grid gap-[2px]">
        {#each presets as p}{@render way(p)}{/each}
    </div>
</fieldset>

{#if saved.length}
    <fieldset>
        <legend class="section-title">Your colour ways</legend>
        <div class="grid gap-[2px]">
            {#each saved as p (p.name)}
                <div class="flex gap-[2px]">
                    {@render way(p)}
                    <button class="btn px-3" aria-label="Delete colour way {p.name}" onclick={() => confirm(`Delete the colour way "${p.name}"?`) && del(p.name)}>×</button>
                </div>
            {/each}
        </div>
    </fieldset>
{/if}

<div class="grid grid-cols-2 gap-3">
    <div><label class="label" for="bg">Background</label><input id="bg" type="color" bind:value={c.colors.background} disabled={c.colors.transparent} /></div>
    <div><label class="label" for="text">Text</label><input id="text" type="color" bind:value={c.colors.text} /></div>
    <div><label class="label" for="axis">Axis</label><input id="axis" type="color" bind:value={c.colors.axis} /></div>
    <div><label class="label" for="grid">Grid</label><input id="grid" type="color" bind:value={c.colors.grid} /></div>
</div>
<label class="flex items-center gap-2.5 font-mono text-xs text-neutral-200">
    <input type="checkbox" class="check" bind:checked={c.colors.transparent} />Transparent background (SVG and PNG)
</label>

{#if custom && !c.colors.transparent}
    <form class="grid gap-1.5" onsubmit={save}>
        <label class="label mb-0" for="wayname">These colours aren't saved. Save them as a colour way</label>
        <div class="flex gap-[2px]">
            <input id="wayname" class="field" placeholder="Name, e.g. Blog dark" required maxlength="40" bind:value={name} />
            <button class="btn shrink-0" disabled={!name.trim()}>Save</button>
        </div>
        {#if saved.some((w) => w.name === name.trim())}<p class="font-mono text-[11px] text-neutral-500">Replaces your colour way with this name.</p>{/if}
    </form>
{/if}
