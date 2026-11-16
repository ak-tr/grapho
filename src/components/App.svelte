<script lang="ts">
    import { tick } from "svelte";
    import { parse, reshape } from "../lib/data.ts";
    import { PART_NAMES, render, TYPE_NAMES } from "../lib/render.ts";
    import { fresh, list, put, remove, type Doc } from "../lib/store.ts";
    import { total } from "../lib/timeline.ts";
    import Animate from "./Animate.svelte";
    import Axes from "./Axes.svelte";
    import Charts from "./Charts.svelte";
    import Setup from "./Setup.svelte";
    import ThemePicker from "./ThemePicker.svelte";
    import Export from "./Export.svelte";
    import Labels from "./Labels.svelte";
    import Style from "./Style.svelte";
    import Series from "./Series.svelte";
    import OnChart from "./OnChart.svelte";
    import ChartKeys, { type Spot } from "./ui/ChartKeys.svelte";

    // Settings, one tab per thing; opening charts and exporting live in the header
    // Setup is the data and the chart type; the rest follow from it. Three across, two rows.
    const tabs = ["Setup", "Series", "Axes", "Labels", "Style", "Animate"] as const;
    const hide = (id: string) => document.getElementById(id)?.hidePopover();
    let tab = $state<(typeof tabs)[number]>("Setup");

    // Every visit starts on a blank chart; saved ones open from Charts
    let docs = $state(list());
    let doc = $state<Doc>(fresh());
    let status = $state("");

    const raw = $derived(parse(doc.csv));
    // Long data split into series, so everything after this (render, exports, pickers) sees one column per series
    const table = $derived(reshape(raw, doc.config.x, doc.config.reshape));
    const ready = $derived(table.rows.length > 0 && doc.config.ys.length > 0);
    const end = $derived(total(doc.config.anim));
    let t = $state(Infinity);
    let playing = $state(false);
    const now = $derived(Math.min(t, end));
    const svg = $derived(ready ? render(table, doc.config, now, "", true) : "");

    let sw = $state(0);
    let sh = $state(0);
    // The chart fits the stage (inside its 24px padding) at zoom 1; zooming in makes the stage scroll
    const fit = $derived(Math.max(0, Math.min((sw - 48) / doc.config.width, (sh - 48) / doc.config.height)) || 0);
    let zoom = $state(1);
    const scale = $derived(fit * zoom);
    let scroller = $state<HTMLDivElement>();

    /** Zooms to `z` (1 = fit, up to 8×), keeping the point under (cx, cy) in place, or the middle */
    async function zoomTo(z: number, cx?: number, cy?: number) {
        z = Math.min(8, Math.max(1, z));
        if (!scroller || z === zoom) return;
        const r = scroller.getBoundingClientRect();
        const [ox, oy] = [(cx ?? r.left + r.width / 2) - r.left, (cy ?? r.top + r.height / 2) - r.top];
        const [px, py] = [scroller.scrollLeft + ox, scroller.scrollTop + oy];
        const k = z / zoom;
        zoom = z;
        await tick();
        scroller.scrollLeft = px * k - ox;
        scroller.scrollTop = py * k - oy;
    }

    // Pinch on a trackpad, or Ctrl/Cmd with the scroll wheel. Not passive, so the page itself doesn't zoom.
    $effect(() => {
        const el = scroller;
        if (!el) return;
        const wheel = (e: WheelEvent) => {
            if (!e.ctrlKey && !e.metaKey) return;
            e.preventDefault();
            zoomTo(zoom * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
        };
        el.addEventListener("wheel", wheel, { passive: false });
        return () => el.removeEventListener("wheel", wheel);
    });

    // The sidebar's width, dragged (or arrowed) on its edge; remembered in this browser only
    const SIDE = { min: 320, max: 720, start: 400 };
    let side = $state(SIDE.start);
    try {
        side = Math.min(SIDE.max, Math.max(SIDE.min, +(localStorage.getItem("grapho:side") ?? SIDE.start) || SIDE.start));
    } catch {}
    function setSide(w: number) {
        // Leave the chart at least 360px
        side = Math.round(Math.max(SIDE.min, Math.min(SIDE.max, innerWidth - 360, w)));
        try {
            localStorage.setItem("grapho:side", String(side));
        } catch {}
    }
    function resize(e: PointerEvent) {
        if (e.button !== 0) return;
        const el = e.currentTarget as HTMLElement;
        el.setPointerCapture(e.pointerId);
        const moved = (m: PointerEvent) => setSide(m.clientX);
        el.addEventListener("pointermove", moved);
        el.addEventListener("pointerup", () => el.removeEventListener("pointermove", moved), { once: true });
    }
    function resizeKeys(e: KeyboardEvent) {
        const to = ({ ArrowLeft: side - 16, ArrowRight: side + 16, Home: SIDE.min, End: SIDE.max } as Record<string, number>)[e.key];
        if (to === undefined) return;
        e.preventDefault();
        setSide(to);
    }

    function save() {
        if (!doc.csv.trim()) return (status = "");
        try {
            put($state.snapshot(doc));
            docs = list();
            status = "Saved";
        } catch {
            status = "Not saved, storage full";
        }
    }

    // Save a moment after the last change, and again on the way out
    $effect(() => {
        JSON.stringify(doc);
        const timer = setTimeout(save, 400);
        return () => clearTimeout(timer);
    });

    // Click a part of the chart to edit it; drag the legend to move it
    let editor: OnChart;

    // Keyboard access: an invisible button over each part of the chart (see chartParts), placed from the rendered SVG
    let stage = $state<HTMLDivElement>();
    let spots = $state<Spot[]>([]);
    let size = $state([0, 0]);
    let keyBox = $state<number[] | null>(null);
    let lastPart: HTMLElement | null = null;

    // Tab lands on the first; the arrows go by position, Home and End by this order
    const order = ["title", "legend", "yLabel", "y", "series:", "y2", "yLabel2", "x", "xLabel"];
    const rank = (what: string) => order.findIndex((o) => what === o || (o.endsWith(":") && what.startsWith(o)));
    const nameOf = (what: string) => (what.startsWith("series:") ? `Series ${what.slice(7)}` : PART_NAMES[what] ?? what);

    $effect(() => {
        void svg, scale; // re-measure when the chart or its size changes
        if (!stage) return;
        const box = stage.getBoundingClientRect();
        const svgEl = stage.querySelector("svg");
        size = (svgEl?.dataset.inner ?? "0 0").split(" ").map(Number);
        keyBox = stage.querySelector<SVGElement>("[data-box]")?.dataset.box?.split(" ").map(Number) ?? null;
        const found = new Map<string, { l: number; t: number; r: number; b: number }>();
        for (const el of stage.querySelectorAll<SVGGraphicsElement>("svg [data-edit]")) {
            const what = el.dataset.edit!;
            const r = el.getBoundingClientRect();
            if (what === "background" || (!r.width && !r.height)) continue;
            const u = found.get(what);
            found.set(what, u ? { l: Math.min(u.l, r.left), t: Math.min(u.t, r.top), r: Math.max(u.r, r.right), b: Math.max(u.b, r.bottom) } : { l: r.left, t: r.top, r: r.right, b: r.bottom });
        }
        spots = [
            ...[...found].map(([what, r]) => ({ what, label: nameOf(what), left: r.l - box.left, top: r.t - box.top, width: r.r - r.l, height: r.b - r.t })).sort((a, b) => rank(a.what) - rank(b.what)),
            { what: "background", label: nameOf("background"), left: 0, top: 0, width: box.width, height: box.height },
        ];
    });

    function openPart(what: string, el: HTMLElement) {
        lastPart = el;
        const r = el.getBoundingClientRect();
        editor.open(what, r.left, Math.min(r.bottom, innerHeight - 40));
    }

    // Back to the part once its editor closes, unless focus went somewhere else on purpose
    function closed() {
        if (lastPart && (!document.activeElement || document.activeElement === document.body)) lastPart.focus();
        lastPart = null;
    }
    let drag: { x0: number; y0: number; box: number[]; moved: boolean } | null = null;
    let dragged = false;

    function down(e: PointerEvent) {
        playing = false;
        dragged = false;
        const lg = (e.target as Element).closest<SVGElement>('[data-box]');
        if (lg && keyBox && e.button === 0) drag = { x0: e.clientX, y0: e.clientY, box: keyBox, moved: false };
    }

    function move(e: PointerEvent) {
        if (!drag || (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 4)) return;
        if (!drag.moved) (drag.moved = true), (e.currentTarget as Element).setPointerCapture(e.pointerId);
        const [x, y, w, h] = drag.box;
        // The key's box and position are inside the padding and above the watermark (size, measured from the SVG)
        const [W, H] = size;
        const at = (v: number, size: number, max: number) => Math.min(Math.max(v, 0), max - size) / max;
        doc.config.legendAt = { x: at(x + (e.clientX - drag.x0) / scale, w, W), y: at(y + (e.clientY - drag.y0) / scale, h, H) };
    }

    function up() {
        dragged = !!drag?.moved;
        drag = null;
    }

    // Double-clicking the key puts it back above the plot
    function reset(e: MouseEvent) {
        if ((e.target as Element).closest('[data-edit="legend"]')) (doc.config.legendAt = null), editor.close();
    }

    function click(e: MouseEvent) {
        if (dragged) return (dragged = false);
        const what = (e.target as Element).closest("[data-edit]")?.getAttribute("data-edit");
        if (what) editor.open(what, e.clientX, e.clientY);
    }

    function play() {
        if (now >= end) t = 0;
        playing = true;
        let last = performance.now();
        const tick = (ms: number) => {
            if (!playing) return;
            t = Math.min(end, now + ms - last);
            last = ms;
            if (t < end) requestAnimationFrame(tick);
            else playing = false;
        };
        requestAnimationFrame(tick);
    }

    function open(d: Doc) {
        save();
        playing = false;
        t = Infinity;
        doc = d;
        tab = "Setup";
    }

    function del(id: string) {
        remove(id);
        docs = list();
        if (doc.id === id) open(fresh());
    }
</script>

<svelte:window onpagehide={save} />
<OnChart bind:this={editor} bind:config={doc.config} {table} onclose={closed} />
<svelte:document onvisibilitychange={() => document.visibilityState === "hidden" && save()} />

<div class="flex h-dvh flex-col font-mono text-xs uppercase tracking-wide text-neutral-500">
    <header class="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-neutral-800 px-4 sm:px-6">
        <h1 class="text-white">Grapho</h1>
        <nav class="flex items-center gap-[2px]">
            <button class="btn py-1.5" popovertarget="charts-menu" aria-haspopup="true">Charts ▾</button>
            <button class="btn py-1.5" popovertarget="export-menu" aria-haspopup="true" disabled={!ready}>Export ↓</button>
            <ThemePicker />
        </nav>
    </header>

    <!-- Header menus: popovers close on Escape or a click outside -->
    <div id="charts-menu" popover class="menu gap-4">
        <Charts {docs} current={doc.id} onopen={(d) => (open(d), hide("charts-menu"))} ondelete={del} onnew={() => (open(fresh()), hide("charts-menu"))} />
    </div>
    <div id="export-menu" popover class="menu gap-6">
        {#if ready}<Export bind:doc {table} />{/if}
    </div>

    <main class="flex min-h-0 flex-1 flex-col overflow-y-auto font-sans text-base normal-case tracking-normal text-neutral-200 md:grid md:grid-cols-[var(--side)_minmax(0,1fr)] md:overflow-hidden" style:--side="{side}px">
        <aside class="order-2 border-neutral-800 max-md:border-t md:order-none md:flex md:min-h-0 md:flex-col md:border-r">
            <div role="tablist" class="grid shrink-0 grid-cols-3 border-b border-neutral-800">
                {#each tabs as name, i}
                    <button
                        role="tab"
                        aria-selected={tab === name}
                        onclick={() => (tab = name)}
                        class="h-10 border-neutral-800 font-mono text-[11px] uppercase tracking-wide outline-none focus-visible:bg-invert focus-visible:text-black can-hover:hover:bg-invert can-hover:hover:text-black {i % 3 ? 'border-l' : ''} {i < 3 ? 'border-b' : ''} {tab === name ? 'bg-tile text-white' : 'text-neutral-500'}"
                    >
                        {name}
                    </button>
                {/each}
            </div>
            <!-- Only the panel scrolls, under the tabs; it keeps room for its scrollbar so tabs don't change its width -->
            <div role="tabpanel" data-scroller class="grid content-start gap-6 p-4 sm:p-6 md:min-h-0 md:flex-1 md:overflow-y-auto md:overflow-x-hidden md:[scrollbar-gutter:stable]">
                {#if tab === "Setup"}
                    <Setup bind:doc {raw} {table} />
                {:else if tab === "Series"}
                    <Series bind:config={doc.config} {table} />
                {:else if tab === "Axes"}
                    <Axes bind:config={doc.config} />
                {:else if tab === "Labels"}
                    <Labels bind:config={doc.config} />
                {:else if tab === "Style"}
                    <Style bind:config={doc.config} />
                {:else}
                    <Animate bind:config={doc.config} />
                {/if}
            </div>
        </aside>

        <section class="relative flex min-w-0 flex-col md:min-h-0">
            <!-- The sidebar's edge: drag it, or focus it and use the arrows; double-click for the default width -->
            <!-- A focusable separator is a widget (ARIA window splitter); Svelte's check doesn't know that -->
            <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
            <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize the sidebar"
                aria-valuenow={side}
                aria-valuemin={SIDE.min}
                aria-valuemax={SIDE.max}
                tabindex="0"
                onpointerdown={resize}
                onkeydown={resizeKeys}
                ondblclick={() => setSide(SIDE.start)}
                class="group absolute inset-y-0 -left-1.5 z-10 hidden w-3 cursor-col-resize touch-none outline-none md:block"
            >
                <span class="mx-auto block h-full w-px bg-transparent group-focus-visible:w-0.5 group-focus-visible:bg-white can-hover:group-hover:w-0.5 can-hover:group-hover:bg-neutral-500"></span>
            </div>
            <div class="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-neutral-800 px-4 sm:px-6">
                <input bind:value={doc.name} aria-label="Chart name" class="min-w-0 flex-1 bg-transparent font-medium text-white outline-none focus-visible:underline focus-visible:decoration-neutral-600 focus-visible:underline-offset-4" />
                {#if ready && doc.config.legend && doc.config.legendAt}
                    <button class="btn shrink-0 py-1 text-[11px]" onclick={() => (doc.config.legendAt = null)}>Reset key position</button>
                {/if}
                <span class="shrink-0 font-mono text-xs uppercase tracking-wide text-neutral-500">
                    {ready ? `${TYPE_NAMES[doc.config.type]} / ${doc.config.ys.length} series` : ""}{ready && status ? " / " : ""}<span aria-live="polite">{status}</span>
                </span>
            </div>

            <div class="min-h-0 md:flex-1">
                <!-- safe center: centred while it fits, scrollable from the top-left once zoomed past the stage -->
                <div bind:this={scroller} class="grid h-full overflow-auto p-6 [place-items:safe_center] max-md:[aspect-ratio:var(--ar)]" style:--ar="{doc.config.width} / {doc.config.height}" bind:clientWidth={sw} bind:clientHeight={sh}>
                    {#if ready}
                        <!-- Pointer handlers here; keyboard users get the same through the Parts layer inside -->
                        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                        <div
                            bind:this={stage}
                            title="Click to edit. Drag the key to move it, double-click it to put it back."
                            style:width="{doc.config.width * scale}px"
                            style:height="{doc.config.height * scale}px"
                            onpointerdown={down}
                            onpointermove={move}
                            onpointerup={up}
                            onpointercancel={up}
                            onclick={click}
                            ondblclick={reset}
                            class="editable relative select-none outline outline-1 outline-offset-[6px] outline-neutral-700 [background:repeating-conic-gradient(rgb(var(--tile-2))_0_25%,rgb(var(--tile-3))_0_50%)_0_0/16px_16px] [&>svg]:size-full"
                        >
                            {@html svg}
                            <ChartKeys
                                {spots}
                                label="{doc.config.type} chart. Arrow keys move between its parts, Enter edits one, Alt and the arrows move the key."
                                positions={keyBox ? { legend: { x: keyBox[0], y: keyBox[1] } } : {}}
                                bounds={() => (keyBox ? { minX: 0, minY: 0, maxX: size[0] - keyBox[2], maxY: size[1] - keyBox[3] } : undefined)}
                                step={doc.config.fontSize / 2}
                                onPositionsChange={(p) => p.legend && (doc.config.legendAt = { x: p.legend.x / size[0], y: p.legend.y / size[1] })}
                                onOpen={openPart}
                            />
                        </div>
                    {:else}
                        <div class="grid max-w-sm justify-items-start gap-4 border border-dashed border-neutral-700 p-6 font-mono text-xs text-neutral-400">
                            <p>{table.rows.length ? "Pick at least one series to show, in Series." : "No data yet. Import a CSV, TSV or JSON file, or paste one in Setup."}</p>
                            <!-- The most recently saved chart other than this one (the list is newest first) -->
                            {#if !table.rows.length && docs.find((d) => d.id !== doc.id)}
                                {@const last = docs.find((d) => d.id !== doc.id)!}
                                <button class="btn" onclick={() => open(last)}>Open last chart →</button>
                            {/if}
                        </div>
                    {/if}
                </div>
            </div>

            <div class="grid shrink-0 grid-cols-[auto_1fr_auto] items-center sm:grid-cols-[auto_1fr_auto_auto] gap-4 border-t border-neutral-800 px-4 py-3 font-mono text-xs uppercase sm:px-6">
                <button class="btn" disabled={!ready} onclick={() => (playing ? (playing = false) : play())}>{playing ? "Pause" : "Play"}</button>
                <input
                    type="range"
                    min="0"
                    max={end}
                    step="1"
                    value={now}
                    disabled={!ready}
                    oninput={(e) => ((playing = false), (t = +e.currentTarget.value))}
                    aria-label="Timeline"
                    class="w-full accent-neutral-200"
                />
                <span class="tabular-nums text-neutral-500">{(now / 1000).toFixed(1)} / {(end / 1000).toFixed(1)}s</span>
                <!-- Zoom: the % is of the chart's real size; pinch or Ctrl/Cmd and scroll on the chart works too -->
                <span class="hidden items-center gap-[2px] sm:flex" role="group" aria-label="Zoom">
                    <button class="btn px-2.5" aria-label="Zoom out" disabled={!ready || zoom <= 1} onclick={() => zoomTo(zoom / 1.25)}>−</button>
                    <button class="btn w-16 px-0 tabular-nums" title="Fit to the stage" aria-label="Zoom to fit, now {Math.round(scale * 100)}%" disabled={!ready || zoom === 1} onclick={() => zoomTo(1)}>{zoom === 1 ? "Fit" : `${Math.round(scale * 100)}%`}</button>
                    <button class="btn px-2.5" aria-label="Zoom in" disabled={!ready || zoom >= 8} onclick={() => zoomTo(zoom * 1.25)}>+</button>
                </span>
            </div>
        </section>
    </main>
</div>
