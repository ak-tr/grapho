<script lang="ts">
    import { usePart, type PrimitiveHandle } from "@ui-sdk/svelte/primitive";
    import { chartParts } from "../../lib/primitives.ts";
    import type { Spot } from "./ChartKeys.svelte";

    let { handle, spot }: { handle: PrimitiveHandle<typeof chartParts>; spot: Spot } = $props();
    const part = usePart(handle, "part", () => ({ value: spot.what }));
</script>

<button
    {...part.slot({
        "aria-label": spot.label,
        class: "absolute outline-none focus-visible:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
        style: `left: ${spot.left}px; top: ${spot.top}px; width: ${spot.width}px; height: ${spot.height}px`,
    })}
></button>
