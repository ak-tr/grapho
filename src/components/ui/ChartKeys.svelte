<!--
    Keyboard access to the chart: one Tab stop, the arrows move between parts by position, Enter edits, Alt and the
    arrows move the key. Behaviour from UI SDK (chartParts in lib/primitives.ts), written out by hand because this
    beta's createParts doesn't update content passed into a part.
-->
<script lang="ts">
    import { usePrimitive } from "@ui-sdk/svelte/primitive";
    import ChartKey from "./ChartKey.svelte";
    import { chartParts } from "../../lib/primitives.ts";
    import type { MovePoint } from "@ui-sdk/core";

    export type Spot = { what: string; label: string; left: number; top: number; width: number; height: number };
    type Props = {
        spots: Spot[];
        label: string;
        positions: Record<string, MovePoint>;
        bounds: (key: string) => { minX: number; minY: number; maxX: number; maxY: number } | undefined;
        step: number;
        onPositionsChange: (value: Record<string, MovePoint>) => void;
        onOpen: (key: string, el: HTMLElement) => void;
    };
    let { spots, label, ...options }: Props = $props();
    const id = $props.id();
    const handle = usePrimitive(chartParts, () => ({ ...options, id }));
</script>

<div role="group" aria-label={label} class="pointer-events-none absolute inset-0">
    {#each spots as spot (spot.what)}
        <ChartKey {handle} {spot} />
    {/each}
</div>
