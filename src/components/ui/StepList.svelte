<!--
    A list you reorder by dragging each item's handle, or with the keyboard: focus a handle, press Space or Enter,
    move with the arrows, Space or Enter again to drop, Escape to cancel. The other items slide out of the way.
    Behaviour from UI SDK (stepList in lib/primitives.ts), written out by hand because this beta's createParts
    doesn't update content passed into a part.
-->
<script lang="ts">
    import type { Snippet } from "svelte";
    import { flip } from "svelte/animate";
    import { cubicOut } from "svelte/easing";
    import { usePart, usePrimitive, type PrimitiveHandle } from "@ui-sdk/svelte/primitive";
    import StepItem from "./StepItem.svelte";
    import { stepList } from "../../lib/primitives.ts";

    type Props = {
        value: string[];
        onValueChange: (value: string[]) => void;
        label: (key: string) => string | undefined;
        class?: string;
        "aria-label": string;
        /** One item's content, with the handle owner to pass to StepHandle */
        item: Snippet<[key: string, index: number, handle: PrimitiveHandle<typeof stepList>]>;
    };
    let { item, class: cls, "aria-label": ariaLabel, ...options }: Props = $props();
    const id = $props.id();
    const handle = usePrimitive(stepList, () => ({ ...options, id }));
    const root = usePart(handle, "root");

    // The card being dragged follows the pointer itself; the rest slide into place
    const slide = (node: Element, rects: { from: DOMRect; to: DOMRect }) =>
        node.hasAttribute("data-dragging") ? { duration: 0 } : flip(node, rects, { duration: 180, easing: cubicOut });
</script>

<ol {...root.slot({ class: `relative ${cls ?? ""}`, "aria-label": ariaLabel })}>
    {#each root.state.order as key, i (key)}
        <li data-key={key} animate:slide>
            <StepItem {handle} value={key}>{@render item(key, i, handle)}</StepItem>
        </li>
    {/each}
</ol>
