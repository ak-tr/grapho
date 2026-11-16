<!--
    The editor that opens where you click on the chart. `what` is the clicked part's data-edit tag from render():
    background, x, y, y2, xLabel, yLabel, yLabel2, legend, or series:<name>.
-->
<script lang="ts">
    import { label, type Table } from "../lib/data.ts";
    import { PART_NAMES, seriesColor, type Config } from "../lib/render.ts";

    let { config: c = $bindable(), table, onclose }: { config: Config; table: Table; onclose?: () => void } = $props();

    let what = $state("");
    let menu: HTMLDivElement;

    export function open(w: string, x: number, y: number) {
        what = w;
        const down = y < innerHeight / 2;
        Object.assign(menu.style, {
            left: `${Math.max(8, Math.min(x, innerWidth - 296))}px`,
            top: down ? `${y + 12}px` : "",
            bottom: down ? "" : `${innerHeight - y + 12}px`,
            maxHeight: `${(down ? innerHeight - y : y) - 24}px`,
        });
        menu.showPopover();
        requestAnimationFrame(() => menu.querySelector<HTMLElement>("input:not([type=checkbox]), button")?.focus());
    }
    export const close = () => menu.hidePopover();
    const enter = (e: KeyboardEvent) => e.key === "Enter" && close();

    const nullable = (key: "yMin" | "yMax" | "yMin2" | "yMax2") => [() => c[key] ?? null, (v: number | null | undefined) => (c[key] = typeof v === "number" ? v : null)] as const;
    const [getMin, setMin] = nullable("yMin");
    const [getMax, setMax] = nullable("yMax");
    const [getMin2, setMin2] = nullable("yMin2");
    const [getMax2, setMax2] = nullable("yMax2");

    const series = $derived(what.startsWith("series:") ? what.slice(7) : "");
    const isY = $derived(c.ys.includes(series));
    const right = $derived((c.right ?? []).includes(series));
    // Pie slices are rows, coloured in row order unless picked
    const index = $derived(isY ? c.ys.indexOf(series) : table.rows.filter((r) => r[c.x] != null).findIndex((r) => label(r[c.x]) === series));
    const horiz = $derived(c.type === "hbar");

    const setSide = (s: "L" | "R") => (c.right = s === "R" ? [...(c.right ?? []).filter((y) => y !== series), series] : (c.right ?? []).filter((y) => y !== series));
    function hide() {
        c.ys = c.ys.filter((y) => y !== series);
        c.right = (c.right ?? []).filter((y) => y !== series);
        c.anim.steps = c.anim.steps.filter((s) => s.target !== series);
        close();
    }

</script>

{#snippet text(id: string, name: string, get: () => string, set: (v: string) => void, placeholder = "")}
    <div><label class="label" for="oc-{id}">{name}</label><input id="oc-{id}" class="field" {placeholder} bind:value={get, set} onkeydown={enter} /></div>
{/snippet}
{#snippet num(id: string, name: string, get: () => number | null, set: (v: number | null) => void, attrs: Record<string, number> = {})}
    <div><label class="label" for="oc-{id}">{name}</label><input id="oc-{id}" type="number" class="field" {...attrs} bind:value={get, set} onkeydown={enter} /></div>
{/snippet}
{#snippet shorten()}
    <label class="col-span-2 flex items-center gap-2.5 font-mono text-xs"><input type="checkbox" class="check" bind:checked={() => c.compact !== false, (v) => (c.compact = v)} />Shorten large numbers (2.5k, 1.2m)</label>
    <label class="col-span-2 flex items-center gap-2.5 font-mono text-xs"><input type="checkbox" class="check" bind:checked={() => !!c.percent, (v) => (c.percent = v)} />Show as percent (0.25 → 25%)</label>
{/snippet}
{#snippet colour(id: string, name: string, get: () => string, set: (v: string) => void, disabled = false)}
    <div><label class="label" for="oc-{id}">{name}</label><input id="oc-{id}" type="color" {disabled} bind:value={get, set} /></div>
{/snippet}

<div bind:this={menu} popover ontoggle={(e) => (e as ToggleEvent).newState === "closed" && onclose?.()} class="fixed inset-auto m-0 w-72 overflow-y-auto border border-neutral-700 bg-tile p-0 font-sans text-base normal-case tracking-normal text-neutral-200">
    <div class="flex h-9 items-center justify-between border-b border-neutral-800 pl-3 font-mono text-[11px] uppercase text-neutral-400">
        <span class="truncate">{series ? `${isY ? "Series" : "Slice"} / ${series}` : PART_NAMES[what]}</span>
        <button class="h-full px-3 outline-none focus-visible:bg-invert focus-visible:text-black can-hover:hover:bg-invert can-hover:hover:text-black" aria-label="Close" onclick={close}>×</button>
    </div>
    <div class="grid grid-cols-2 gap-3 p-3">
        {#if what === "title"}
            <div class="col-span-2">{@render text("title", "Title", () => c.title ?? "", (v) => (c.title = v))}</div>
        {:else if what === "xLabel" || what === "yLabel" || what === "yLabel2"}
            <div class="col-span-2">{@render text(what, "Name", () => c[what as "xLabel"] ?? "", (v) => (c[what as "xLabel"] = v))}</div>
        {:else if what === "x"}
            <div class="col-span-2">{@render text("xl", "Name", () => c.xLabel, (v) => (c.xLabel = v))}</div>
            {@render colour("axis", "Axis", () => c.colors.axis, (v) => (c.colors.axis = v))}
            {@render colour("tx", "Text", () => c.colors.text, (v) => (c.colors.text = v))}
        {:else if what === "y"}
            <div class="col-span-2">{@render text("yl", "Name", () => c.yLabel, (v) => (c.yLabel = v))}</div>
            {@render num("ymin", "Min (blank = auto)", getMin, setMin)}
            {@render num("ymax", "Max (blank = auto)", getMax, setMax)}
            {@render text("unit", "Unit", () => c.unit, (v) => (c.unit = v), "°C")}
            {@render num("dec", "Decimals", () => c.decimals, (v) => (c.decimals = v ?? 0), { min: 0, max: 6 })}
            {@render num("ticks", "Ticks", () => c.ticks, (v) => (c.ticks = v ?? 6), { min: 2, max: 20 })}
            {@render shorten()}
        {:else if what === "y2"}
            <div class="col-span-2">{@render text("yl2", "Name", () => c.yLabel2 ?? "", (v) => (c.yLabel2 = v))}</div>
            {@render num("ymin2", "Min (blank = auto)", getMin2, setMin2)}
            {@render num("ymax2", "Max (blank = auto)", getMax2, setMax2)}
            {@render text("unit2", "Unit", () => c.unit2 ?? "", (v) => (c.unit2 = v), "RPM")}
            {@render shorten()}
        {:else if what === "legend"}
            <label class="col-span-2 flex items-center gap-2.5 font-mono text-xs"><input type="checkbox" class="check" bind:checked={() => !!c.legendStack, (v) => (c.legendStack = v)} />Stack, one per row</label>
            <button class="btn" disabled={!c.legendAt} onclick={() => ((c.legendAt = null), close())}>Reset position</button>
            <button class="btn" onclick={() => ((c.legend = false), close())}>Hide key</button>
        {:else if series}
            {@render colour("col", "Colour", () => seriesColor(c, series, Math.max(0, index)), (v) => (c.colors.series[series] = v))}
            {#if isY && c.type !== "pie"}
                {#if !horiz}
                    <fieldset>
                        <legend class="label">Axis</legend>
                        <div class="grid grid-cols-2 gap-[2px]">
                            <button class="btn px-0 {right ? '' : 'btn-primary'}" aria-pressed={!right} onclick={() => setSide("L")}>Left</button>
                            <button class="btn px-0 {right ? 'btn-primary' : ''}" aria-pressed={right} onclick={() => setSide("R")}>Right</button>
                        </div>
                    </fieldset>
                {/if}
                {#if right && !horiz}
                    {@render text("su", "Unit (right)", () => c.unit2 ?? "", (v) => (c.unit2 = v), "RPM")}
                {:else}
                    {@render text("su", "Unit", () => c.unit, (v) => (c.unit = v), "°C")}
                {/if}
                {@render num("sd", "Decimals", () => c.decimals, (v) => (c.decimals = v ?? 0), { min: 0, max: 6 })}
                <button class="btn col-span-2" onclick={hide}>Hide this series</button>
            {/if}
        {:else}
            <div class="col-span-2">{@render text("title", "Title (blank = none)", () => c.title ?? "", (v) => (c.title = v))}</div>
            {@render colour("bg", "Background", () => c.colors.background, (v) => (c.colors.background = v), c.colors.transparent)}
            {@render colour("tx", "Text", () => c.colors.text, (v) => (c.colors.text = v))}
            {@render colour("axis", "Axis", () => c.colors.axis, (v) => (c.colors.axis = v))}
            {@render colour("grid", "Grid", () => c.colors.grid, (v) => (c.colors.grid = v))}
            <label class="col-span-2 flex items-center gap-2.5 font-mono text-xs"><input type="checkbox" class="check" bind:checked={c.colors.transparent} />Transparent background</label>
            <label class="col-span-2 flex items-center gap-2.5 font-mono text-xs"><input type="checkbox" class="check" bind:checked={c.grid} />Grid lines</label>
            <label class="col-span-2 flex items-center gap-2.5 font-mono text-xs"><input type="checkbox" class="check" bind:checked={() => !!c.watermark, (v) => (c.watermark = v)} />Watermark (grapho.akif.kr)</label>
            {@render num("pad", "Padding (px)", () => c.padding ?? 0, (v) => (c.padding = Math.max(0, v ?? 0)), { min: 0, step: 4 })}
        {/if}
    </div>
</div>
