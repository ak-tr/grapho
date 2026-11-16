// Keyboard behaviour from UI SDK (@ui-sdk/core, beta). Rendered in Svelte with createParts from @ui-sdk/svelte/primitive.
import {
    bindDrag,
    createChange,
    dragThreshold,
    createMove,
    createReorder,
    createRovingFocus,
    definePrimitive,
    spatialMove,
    type MoveDraft,
    type MovePoint,
    type ReorderDraft,
} from "@ui-sdk/core";

type ChartPartsOptions = {
    /** Where movable parts sit (only the key, "legend"), in chart units */
    positions?: Record<string, MovePoint>;
    /** How far each movable part can go: the chart's inner size minus the part's */
    bounds?: (key: string) => { minX: number; minY: number; maxX: number; maxY: number } | undefined;
    step?: number;
    onPositionsChange?: (value: Record<string, MovePoint>) => void;
    onOpen?: (key: string, el: HTMLElement) => void;
};

/**
 * One Tab stop for the whole chart. The arrows go to the nearest part in that direction, Enter or Space opens its
 * editor, and Alt with the arrows moves the key (Shift for bigger steps).
 */
export const chartParts = definePrimitive({
    name: "chart-parts",
    options: { positions: "value", bounds: "value", step: "number", onPositionsChange: "callback", onOpen: "callback" },
    controlled: ["positions"],
    state: (o: ChartPartsOptions) => ({ positions: o.positions ?? {}, moving: null as MoveDraft | null, focused: null as string | null }),
    sync: (o) => (o.positions === undefined ? {} : { positions: o.positions }),
    api: (context) => {
        const change = createChange(context);
        return {
            roving: createRovingFocus(context, { slot: "part", key: "focused", move: spatialMove() }),
            move: createMove(context, {
                key: "positions",
                draft: "moving",
                set: (value, details) => change("positions", value, details),
                step: () => context.options().step ?? 10,
                bounds: (key) => context.options().bounds?.(key),
                disabled: (key) => key !== "legend",
                label: () => "Key",
            }),
            open: (key: string, el: HTMLElement) => context.options().onOpen?.(key, el),
        };
    },
    slots: (slot) => ({
        part: slot<{ value: string }>({
            props: { value: "key" },
            role: "button",
            focus: "roving",
            press: ({ api, key, el }) => el && api.open(key, el),
            attrs: (state, part) => ({ type: "button", tabindex: part.api.roving.tabIndex(state, part) }),
            on: {
                keydown: (event, { el, api, key }) => {
                    if (key === "legend" && api.move.keydown(event, key)) return;
                    if (el) api.roving.keydown(event, el);
                },
            },
            bind: (el, part) => part.api.roving.bind(el, part),
        }),
    }),
});

type StepListOptions = {
    /** Step keys in order */
    value?: string[];
    onValueChange?: (value: string[]) => void;
    /** What screen readers call a step while it moves */
    label?: (key: string) => string | undefined;
};

/** Animation steps you can drag by their handle, or pick up with Space or Enter, move with the arrows and drop. */
export const stepList = definePrimitive({
    name: "step-list",
    options: { value: "value", onValueChange: "callback", label: "value" },
    controlled: ["value"],
    state: (o: StepListOptions) => ({ value: o.value ?? [], moving: null as ReorderDraft | null }),
    sync: (o) => (o.value === undefined ? {} : { value: o.value }),
    api: (context) => {
        const change = createChange(context);
        const reorder = createReorder(context, {
            slot: "item",
            key: "value",
            draft: "moving",
            set: (value, details) => change("value", value, details),
            label: (key) => context.options().label?.(key),
        });
        return {
            reorder,
            /**
             * A pointer drag by the handle. The built-in one places the item by where the pointer is, which with a
             * handle at the top of a tall card means dragging well past the next card. This places it by the card's
             * leading edge instead (its bottom going down, its top going up), so it swaps once it's halfway over its
             * neighbour. Cards are `[data-key]` in the list.
             */
            drag(event: PointerEvent, key: string, handle: HTMLElement) {
                const list = handle.closest("ol");
                const card = list?.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`);
                if (!list || !card || context.store.get().moving || event.button !== 0) return;
                const scroller = list.closest<HTMLElement>("[data-scroller]");
                const start = { y: event.clientY, scroll: scroller?.scrollTop ?? 0, top: card.offsetTop, height: card.offsetHeight };
                let dy = 0;
                // Keep the card under the pointer as the list reorders around it (only up and down)
                const place = () => card.style.setProperty("--drag-y", `${start.top + dy - card.offsetTop}px`);
                bindDrag(handle, event, {
                    threshold: dragThreshold,
                    cancelOnEscape: true,
                    onStart: () => {
                        if (!reorder.grab(key)) return false;
                        card.setAttribute("data-dragging", "");
                    },
                    onMove: ({ y, event: move }) => {
                        move.preventDefault();
                        dy = y - start.y + (scroller?.scrollTop ?? 0) - start.scroll;
                        const edge = start.top + dy + (dy > 0 ? start.height : 0);
                        const others = [...list.querySelectorAll<HTMLElement>("[data-key]")].filter((el) => el !== card);
                        reorder.moveTo(others.filter((el) => el.offsetTop + el.offsetHeight / 2 < edge).length);
                        place();
                        requestAnimationFrame(place); // again once the new order has rendered
                    },
                    onEnd: (end, canceled) => {
                        card.style.removeProperty("--drag-y");
                        card.removeAttribute("data-dragging");
                        if (canceled) reorder.cancel();
                        else reorder.drop(end);
                    },
                });
            },
        };
    },
    slots: (slot) => ({
        // The order to render: the draft while a step moves, else the committed one
        root: slot<{}, { order: string[] }>({ role: "list", state: (s) => ({ order: s.moving?.order ?? s.value }) }),
        // The <li> around each item is the list's own; the item is the card inside it
        item: slot<{ value: string }>({
            props: { value: "key" },
            role: "group",
            attrs: (state, part) => ({ "data-grabbed": part.api.reorder.moving(state, part.key) ? "" : undefined }),
            bind: (el, part) => part.api.reorder.bind(el, part),
        }),
        // The handle carries its step's key too, since it's rendered as a part of its own
        handle: slot<{ value: string }>({
            props: { value: "key" },
            role: "button",
            focus: "native",
            press: () => {},
            attrs: (state, part) => ({ type: "button", "aria-pressed": String(state.moving?.key === part.key) }),
            on: {
                keydown: (event, { api, key }) => api.reorder.keydown(event, key),
                pointerdown: (event, { api, key, el }) => el && api.drag(event, key, el),
            },
        }),
    }),
});
