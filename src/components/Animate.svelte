<script lang="ts">
    import Select from "./Select.svelte";
    import StepHandle from "./ui/StepHandle.svelte";
    import StepList from "./ui/StepList.svelte";
    import { defaultSteps, type Config } from "../lib/render.ts";
    import type { Ease, Effect, Step } from "../lib/timeline.ts";

    let { config: c = $bindable() }: { config: Config } = $props();
    const effects: Effect[] = ["draw", "fade", "grow", "each"];
    const effectNames: Record<Effect, string> = { draw: "Draw left to right", fade: "Fade in", grow: "Grow", each: "One by one" };
    const eases: Ease[] = ["linear", "in", "out", "in-out"];
    const targets = $derived(["axes", ...(c.title ? ["title"] : []), ...c.ys]);
    const targetName = (tg: string) => (tg === "axes" ? "Axes" : tg === "title" ? "Title" : tg);

    // Steps have no ids of their own, so each step object gets a key while it lives
    const ids = new WeakMap<Step, string>();
    let next = 0;
    const keyOf = (s: Step) => ids.get(s) ?? (ids.set(s, `step-${next++}`), ids.get(s)!);
    const keys = $derived(c.anim.steps.map(keyOf));
    const stepOf = (key: string) => c.anim.steps.find((s) => keyOf(s) === key)!;
</script>

{#if c.anim.steps.length}
    <StepList
        value={keys}
        onValueChange={(order) => (c.anim.steps = order.map(stepOf))}
        label={(key) => `Step ${keys.indexOf(key) + 1}, ${targetName(stepOf(key).target)}`}
        aria-label="Animation steps"
        class="grid gap-[2px]"
    >
        {#snippet item(key, i, handle)}
            {@const step = stepOf(key)}
            <div class="flex items-center justify-between font-mono text-[11px] uppercase text-neutral-500">
                <span class="flex items-center gap-2">
                    <StepHandle {handle} value={key} label="Move step {i + 1}" />
                    Step {String(i + 1).padStart(2, "0")}
                </span>
                <button class="btn px-2 py-1" aria-label="Remove step {i + 1}" onclick={() => (c.anim.steps = c.anim.steps.filter((s) => s !== step))}>×</button>
            </div>
            <div class="grid grid-cols-2 gap-2">
                <Select label="What" bind:value={step.target} options={targets.map((tg) => ({ value: tg, label: targetName(tg) }))} />
                <Select label="How" bind:value={step.effect} options={effects.map((e) => ({ value: e, label: effectNames[e] }))} />
                <label class="flex items-center gap-2 font-mono text-[11px] uppercase text-neutral-500">
                    <input type="number" min="0" step="100" class="field" aria-label="Duration in ms" bind:value={step.ms} />ms
                </label>
                <Select label="Easing" bind:value={step.ease} options={eases.map((e) => ({ value: e, label: `Ease ${e}` }))} />
            </div>
            {#if i > 0}
                <label class="flex items-center gap-2.5 font-mono text-xs text-neutral-200">
                    <input type="checkbox" class="check" bind:checked={step.together} />Start with the previous step
                </label>
            {/if}
            {#if step.effect === "each"}
                <p class="font-mono text-[11px] text-neutral-500">Each bar, point or slice in turn, with its own easing. Lines draw left to right.</p>
            {/if}
        {/snippet}
    </StepList>
    <p id="steps-help" class="font-mono text-[11px] text-neutral-500">Drag ⠿ to reorder. Or focus it, press Space, move with the arrows and press Space again. Escape cancels.</p>
{:else}
    <p class="border border-dashed border-neutral-700 p-3 font-mono text-xs text-neutral-500">No steps, so the chart shows straight away.</p>
{/if}

<div class="flex flex-wrap gap-[2px]">
    <button class="btn" onclick={() => c.anim.steps.push({ target: c.ys[0] ?? "axes", effect: "fade", ms: 1000, ease: "out", together: false })}>Add step</button>
    <button class="btn" onclick={() => (c.anim.steps = defaultSteps(c))}>Reset to default</button>
</div>

<label class="flex items-center gap-2.5 font-mono text-xs text-neutral-200">
    <input type="checkbox" class="check" bind:checked={c.anim.rescale} />Grow the Y axis to fit each series as it comes in
</label>

<div class="grid grid-cols-2 gap-3">
    <div><label class="label" for="hold">Pause at the end (ms)</label><input id="hold" type="number" min="0" step="100" class="field" bind:value={c.anim.hold} /></div>
</div>
