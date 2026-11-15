export type Effect = "draw" | "fade" | "grow";
export type Ease = "linear" | "in" | "out" | "in-out";
/** `target` is "axes" or a series (column) name. `together` starts it with the previous step instead of after. */
export type Step = { target: string; effect: Effect; ms: number; ease: Ease; together: boolean };
/** `fps` is for MP4, `gifFps` for GIF (older saved charts may not have it). */
export const MP4_FPS = [24, 25, 30, 50, 60];
/** GIF frame delays are whole 1/100 s, so only rates that divide 100 play at the right speed */
export const GIF_FPS = [10, 20, 25, 50];

export type Animation = { steps: Step[]; hold: number; rescale: boolean; fps: number; gifFps?: number };

const eases: Record<Ease, (p: number) => number> = {
    linear: (p) => p,
    in: (p) => p * p * p,
    out: (p) => 1 - (1 - p) ** 3,
    "in-out": (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2),
};

export function schedule(steps: Step[]) {
    let cursor = 0;
    let prev = 0;
    const timed = steps.map((s) => {
        const start = s.together ? prev : cursor;
        prev = start;
        cursor = Math.max(cursor, start + s.ms);
        return { ...s, start };
    });
    return { timed, end: cursor };
}

export const total = (a: Animation) => schedule(a.steps).end + a.hold;

/** Where every target is at time `t`. Targets without a step are fully shown (p = 1). */
export function at(a: Animation, t: number) {
    const state = new Map<string, { effect: Effect; p: number; start: number }>();
    for (const s of schedule(a.steps).timed) {
        if (state.has(s.target)) continue; // first step per target wins
        const raw = s.ms ? Math.min(1, Math.max(0, (t - s.start) / s.ms)) : t >= s.start ? 1 : 0;
        state.set(s.target, { effect: s.effect, p: eases[s.ease](raw), start: s.start });
    }
    return (target: string) => state.get(target) ?? { effect: "fade" as Effect, p: 1, start: -Infinity };
}
