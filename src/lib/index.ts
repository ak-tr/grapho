/**
 * The public API of the grapho package (built by packages/grapho). The rest of src/lib is for the app;
 * whatever this file exports is what other people's code depends on, so change it with care.
 */
import { parse, reshape, type Table } from "./data.ts";
import { defaults, defaultSteps, render, type Config } from "./render.ts";
import { total, type Animation } from "./timeline.ts";

export { parse, reshape, render, total };
export { FONTS } from "./render.ts";
export type { Reshape, Row, Table, Value } from "./data.ts";
export type { ChartType, Config, Curve, Font } from "./render.ts";
export type { Animation, Ease, Effect, Step } from "./timeline.ts";

/** Any part of Config (colours and animation can be partial too). Whatever is left out is picked for the data. */
export type Options = Partial<Omit<Config, "colors" | "anim">> & { colors?: Partial<Config["colors"]>; anim?: Partial<Animation> };
/** CSV, TSV or JSON text; an array of rows or an object of columns; or a Table from parse() */
export type Data = string | object;

const isTable = (d: object): d is Table => Array.isArray((d as Table).columns) && Array.isArray((d as Table).rows);
const defined = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/** The data as a Table and a full Config: the options over the defaults for that data. Throws if the data can't be read. */
export function chart(data: Data, options: Options = {}): { table: Table; config: Config } {
    let table = typeof data === "string" ? parse(data) : isTable(data) ? data : parse(JSON.stringify(data));
    if (table.error) throw new Error(table.error);
    const o = defined(options);
    // Long data is split into series first, so the default series are the split ones
    if (o.reshape) table = reshape(table, o.x ?? defaults(table).x, o.reshape);
    const d = defaults(table);
    const config: Config = { ...d, ...o, colors: { ...d.colors, ...defined(o.colors ?? {}) }, anim: { ...d.anim, ...defined(o.anim ?? {}) } };
    // The default axis names and animation follow the default columns; make them follow the chosen ones
    if (o.x && o.xLabel == null) config.xLabel = o.x;
    if (o.ys && o.yLabel == null) config.yLabel = o.ys.length === 1 ? o.ys[0] : "";
    if (!o.anim?.steps) config.anim.steps = defaultSteps(config);
    return { table, config };
}

/** The chart as an SVG string, `t` ms into its animation (fully shown by default). Works without a DOM. */
export function svg(data: Data, options: Options = {}, t = Infinity): string {
    const { table, config } = chart(data, options);
    return render(table, config, t);
}

export type Drawn = {
    table: Table;
    config: Config;
    /** Length of the animation in ms, including the hold at the end */
    duration: number;
    /** Shows the chart `t` ms into its animation */
    seek(t: number): void;
    /** Plays the animation from the start; resolves when it ends or stop() is called */
    play(): Promise<void>;
    stop(): void;
    /**
     * Redraws with new data or options (given in full, as for draw), at the same moment of the animation.
     * A playing animation keeps playing. For frameworks: call it when props change, instead of drawing again.
     */
    update(data: Data, options?: Options): void;
};

/**
 * Draws the chart into `el`, replacing what's in it, fully shown and as wide as `el`.
 * The chart is an SVG, so it stays sharp at any size. play() runs its animation.
 */
export function draw(el: Element, data: Data, options: Options = {}): Drawn {
    let frame = 0;
    let finish = () => {};
    // Where the animation is; Infinity = fully shown, however long the animation becomes
    let now = Infinity;
    const drawn: Drawn = {
        ...chart(data, options),
        duration: 0,
        seek(t) {
            now = t;
            el.innerHTML = render(drawn.table, drawn.config, Math.min(t, drawn.duration));
            el.firstElementChild?.setAttribute("style", "display:block;width:100%;height:auto");
        },
        stop() {
            cancelAnimationFrame(frame);
            finish();
        },
        play() {
            drawn.stop();
            return new Promise<void>((done) => {
                let start: number | undefined;
                finish = () => {
                    finish = () => {};
                    done();
                };
                const tick = (ms: number) => {
                    start ??= ms;
                    drawn.seek(ms - start);
                    if (ms - start < drawn.duration) frame = requestAnimationFrame(tick);
                    else (now = Infinity), finish();
                };
                frame = requestAnimationFrame(tick);
            });
        },
        update(data, options = {}) {
            Object.assign(drawn, chart(data, options));
            drawn.duration = total(drawn.config.anim);
            drawn.seek(now);
        },
    };
    drawn.duration = total(drawn.config.anim);
    drawn.seek(now);
    return drawn;
}
