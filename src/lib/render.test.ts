import assert from "node:assert/strict";
import { test } from "node:test";
import { parse, reshape, smooth, suggest } from "./data.ts";
import { clip, compact, defaults, render, seriesColor, stack, type ChartType } from "./render.ts";
import { fresh, load } from "./store.ts";
import { at, schedule, total } from "./timeline.ts";

test("parse detects the separator and types values", () => {
    assert.deepEqual(parse("a,b\n1,x\n2,y").rows, [{ a: 1, b: "x" }, { a: 2, b: "y" }]);
    assert.deepEqual(parse("a\tb\n1\t2").columns, ["a", "b"]);
    assert.deepEqual(parse("a;b\n1;2").rows, [{ a: 1, b: 2 }]);
    assert.deepEqual(parse("a|b\n1|2").rows, [{ a: 1, b: 2 }]);
    assert.deepEqual(parse('name;note\n"x, y";3').rows, [{ name: "x, y", note: 3 }]);
    assert.deepEqual(parse("a;b\n1,5;-2,25").rows, [{ a: 1.5, b: -2.25 }]);
    assert.equal(parse("\uFEFFa,b\r\n1,2\r\n").format, "CSV, comma");
});

test("parse handles a QUADRO export: repeated names, comma ms, trailing separator", () => {
    const t = parse("ID;TIME;TEMPERATURE_C;TEMPERATURE_C;RPM;\n0;2026-11-15 17:30:43,237;33.44;33.46;913;\n1;2026-11-15 17:31:43,271;33.4;33.41;911;");
    assert.deepEqual(t.columns, ["ID", "TIME", "TEMPERATURE_C", "TEMPERATURE_C 2", "RPM"]);
    assert.deepEqual(t.rows[0].TIME, new Date(2026, 10, 15, 17, 30, 43, 237));
    assert.equal(t.rows[1]["TEMPERATURE_C 2"], 33.41);
    const c = defaults(t);
    assert.equal(c.x, "TIME");
    assert.ok(!c.ys.includes("ID"));
    assert.deepEqual(parse("a,a,a 2,\n1,2,3,4").columns, ["a", "a 2", "a 2 2", "Column 4"]);
    assert.deepEqual(parse("a,b\ntrue,NaN").rows, [{ a: "true", b: null }]);
});

test("parse reads JSON rows", () => {
    const want = [{ x: 1, y: "a" }, { x: 2, y: null }];
    assert.deepEqual(parse('[{"x":1,"y":"a"},{"x":"2"}]').rows, want);
    assert.deepEqual(parse('[["x","y"],[1,"a"],[2,null]]').rows, want);
    assert.deepEqual(parse('{"data":[{"x":1,"y":"a"},{"x":2}]}').rows, want);
    assert.ok(parse("[1,").error);
    assert.ok(parse("[]").error);
});

test("smooth is a centred rolling average that skips gaps", () => {
    assert.deepEqual(smooth([1, 2, 3, null, 5], 3), [1.5, 2, 2.5, null, 5]);
    assert.deepEqual(smooth([1, 9], 1), [1, 9]);
});

test("clip ends on the cut, interpolated", () => {
    assert.deepEqual(clip([[0, 0], [10, 10], [20, 0]], 15), [[0, 0], [10, 10], [15, 5]]);
    assert.deepEqual(clip([[0, 0], [10, 10]], -1), []);
});

test("steps run in turn, or together with the previous one", () => {
    const steps = [
        { target: "a", effect: "draw", ms: 100, ease: "linear", together: false },
        { target: "b", effect: "draw", ms: 50, ease: "linear", together: true },
        { target: "c", effect: "fade", ms: 100, ease: "linear", together: false },
    ] as const;
    assert.deepEqual(schedule([...steps]).timed.map((s) => s.start), [0, 0, 100]);
    const a = { steps: [...steps], hold: 10, rescale: false, fps: 30 };
    assert.equal(total(a), 210);
    assert.equal(at(a, 50)("a").p, 0.5);
    assert.equal(at(a, 50)("b").p, 1);
    assert.equal(at(a, 50)("c").p, 0);
    assert.equal(at(a, 0)("unlisted").p, 1);
});

test("JSON in the shapes people have: rows, columns, nested, one object, a plain list", () => {
    const shape = (v: unknown) => {
        const t = parse(JSON.stringify(v, null, 2));
        return [t.columns.join(","), t.rows.length, t.error ?? ""];
    };
    assert.deepEqual(shape([{ x: 1, y: 2 }, { x: 2, y: 4 }]), ["x,y", 2, ""]);
    assert.deepEqual(shape({ x: [1, 2, 3], y: [4, 5, 6] }), ["x,y", 3, ""]);
    assert.deepEqual(shape({ meta: { n: 2 }, data: { items: [{ x: 1, y: 2 }, { x: 2, y: 5 }] } }), ["x,y", 2, ""]);
    assert.deepEqual(shape({ x: 1, y: 2 }), ["x,y", 1, ""]);
    assert.deepEqual(shape([3, 1, 4]), ["value", 3, ""]);
    assert.ok(shape({ nothing: { here: true } })[2]);
});

test("every chart type renders at every point in time without NaN", () => {
    const table = parse("day,x,y\nMon,1,5\nTue,2,\nWed,3,-2\nThu,4,8");
    for (const type of ["line", "area", "bar", "scatter", "pie"] as ChartType[]) {
        const c = { ...defaults(table), type, x: "day", ys: ["x", "y"] };
        c.anim.rescale = true;
        for (const t of [0, 400, 1200, 2500, 99999]) {
            const svg = render(table, c, t);
            assert.ok(svg.startsWith("<svg") && !svg.includes("NaN") && !svg.includes("undefined"), `${type} @ ${t}`);
            assert.ok(type === "pie" || !/[ ,ML]-\d{3,}/.test(svg), `${type} @ ${t} draws outside the chart`);
            if (type === "bar") assert.ok(!render(table, { ...c, type: "hbar" }, t).includes("NaN"), `hbar @ ${t}`);
        }
    }
});

test("edit tags only appear in the preview, and a dragged legend stays on the chart", () => {
    const table = parse("x,a,b\n0,1,2\n1,3,4");
    const c = { ...defaults(table), legendAt: { x: 5, y: -1 } };
    assert.ok(!render(table, c, Infinity).includes("data-edit"));
    // The key doesn't fade in with its series: at the very start it's already there in full
    const start = render(table, { ...c, legendAt: null }, 0);
    assert.ok(/<g transform="translate\([^)]+\)"><g><rect[^>]+\/><text[^>]*>a<\/text>/.test(start), "key shown at t = 0");
    const svg = render(table, c, Infinity, "", true);
    assert.ok(svg.includes('data-edit="series:a"') && svg.includes('data-edit="y"'));
    const [x, y, w] = svg.match(/data-box="([^"]+)"/)![1].split(" ").map(Number);
    assert.ok(y > 0 && x + w < c.width && x > 0, `${x} ${y} ${w}`);
    assert.ok(svg.includes(`fill="${c.colors.background}"/><rect`), "moved key sits on the chart background");
    const h = (cfg: typeof c) => +render(table, cfg, Infinity, "", true).match(/data-box="([^"]+)"/)![1].split(" ")[3];
    assert.ok(h({ ...c, legendStack: true }) > h(c) * 1.5, "stacked key has a row per series");
});

test("y axis fits the data", () => {
    const table = parse("x,y\n0,45\n1,90");
    const ticks = render(table, defaults(table), Infinity).match(/text-anchor="end">[^<]+/g)!.map((s) => +s.split(">")[1]);
    assert.ok(ticks[0] >= 40 && ticks.at(-1)! >= 90 && ticks.at(-1)! <= 100, String(ticks));
});

test("series colours switch to the deeper palette on light backgrounds", () => {
    const c = defaults(parse("x,y\n0,1"));
    const dark = seriesColor(c, "y", 0);
    c.colors.background = "#f2ece1";
    assert.notEqual(seriesColor(c, "y", 0), dark);
});

test("series on the right get their own axis and range", () => {
    const table = parse("t,temp,rpm\n0,33,900\n1,34,2500");
    const c = { ...defaults(table), right: ["rpm"], unit2: " rpm" };
    const svg = render(table, c, Infinity);
    const left = svg.match(/text-anchor="end">[^<]+/g)!.map((s) => +s.split(">")[1]);
    const right = [...svg.matchAll(/dy="0.35em">([\d.]+k?)</g)].map((m) => parseFloat(m[1]) * (m[1].endsWith("k") ? 1000 : 1));
    assert.ok(left.every((v) => v >= 32 && v <= 35), `left ${left}`);
    assert.ok(right.length && right.every((v) => v >= 800 && v <= 2600), `right ${right}`);
    assert.ok(svg.includes("2.5k rpm") && svg.includes("rpm (R)"));
    // End values sit by their lines, before the right axis numbers
    const endX = +svg.match(/<text x="([\d.]+)"[^>]*>2.5k rpm</)![1];
    const axisX = +svg.match(/<text x="([\d.]+)" y="[\d.]+" dy="0.35em">[\d.]+k?</)![1];
    assert.ok(endX < axisX, `end ${endX} axis ${axisX}`);
    for (const type of ["bar", "area", "scatter"] as ChartType[]) assert.ok(!render(table, { ...c, type }, 500).includes("NaN"));
});

test("end labels that would overlap get stacked, inside the plot", () => {
    const at = (y: number) => ({ x: 100, y, w: 50 });
    const ys = stack([at(50), at(52), at(54)], 20, 0, 200).map((l) => l.y);
    assert.deepEqual(ys, [50, 70, 90]);
    assert.deepEqual(stack([at(195), at(198)], 20, 0, 200).map((l) => l.y), [180, 200]);
    assert.deepEqual(stack([at(50), { x: 400, y: 52, w: 50 }], 20, 0, 200).map((l) => l.y), [50, 52]); // apart sideways: left alone
});

test("large numbers use k, m and b", () => {
    const f = (v: number) => compact(v, (n) => n.toFixed(1));
    assert.deepEqual([999, 1000, 2508, -12500, 1_250_000, 999_999.6, 3e9].map(f), ["999.0", "1k", "2.51k", "-12.5k", "1.25m", "1m", "3b"]);
});

test("large numbers can be written out in full", () => {
    const table = parse("x,y\n0,1200\n1,2500000");
    const c = { ...defaults(table), unit: " W" };
    assert.ok(render(table, c, Infinity).includes("2.5m W"));
    const full = render(table, { ...c, compact: false }, Infinity);
    assert.ok(full.includes("2,500,000.0 W") && !/\d[km]</.test(full), "no k or m");
});

test("long data splits into one series per name, filtered by category", () => {
    const t = parse(`date,category,name,change,percentage
2008-11-01,AMD CPU Speeds,1.4 Ghz,-0.0004,0.0036
2008-11-01,AMD CPU Speeds,1.5 Ghz,-0.0025,0.0224
2008-11-01,Intel CPU Speeds,3.0 Ghz,0.01,0.3
2008-12-01,AMD CPU Speeds,1.4 Ghz,0.0001,0.0037
2008-12-01,AMD CPU Speeds,1.5 Ghz,0.0002,0.0226`);
    const r = suggest(t, "date")!;
    assert.deepEqual(r, { splitBy: "name", value: "percentage", filterBy: "category", filterValue: "AMD CPU Speeds" });
    const wide = reshape(t, "date", r);
    assert.deepEqual(wide.columns, ["date", "1.4 Ghz", "1.5 Ghz"]);
    assert.deepEqual(wide.rows.map((row) => row["1.5 Ghz"]), [0.0224, 0.0226]);
    // Without the filter, a name missing on a date is a gap
    assert.deepEqual(reshape(t, "date", { ...r, filterBy: undefined }).rows.map((row) => row["3.0 Ghz"]), [0.3, null]);
    assert.equal(suggest(parse("x,y\n0,1\n1,2"), "x"), null);
    const c = { ...defaults(wide), percent: true };
    assert.ok(render(wide, c, Infinity).includes("2.3%"));
});

test("one by one: bars finish in turn, and a title pushes the key down", () => {
    const table = parse("x,y\na,10\nb,10\nc,10\nd,10");
    const c = { ...defaults(table), type: "bar" as ChartType, ys: ["y"] };
    c.anim = { ...c.anim, steps: [{ target: "y", effect: "each", ms: 1000, ease: "out", together: false }] };
    const heights = (svg: string) => [...svg.matchAll(/<rect x="[\d.]+" y="[\d.]+" width="[\d.]+" height="([\d.]+)" fill="#8dd3c7"/g)].map((m) => +m[1]);
    const mid = heights(render(table, c, 600)).slice(0, 4); // bars a and b done, c on its way, d not started (then the key)
    assert.ok(mid[0] === mid[1] && mid[2] > 0 && mid[2] < mid[0] && mid[3] === 0, String(mid));
    const keyY = (cfg: typeof c) => +render(table, cfg, Infinity).match(/<g transform="translate\([\d.]+ ([\d.]+)\)"/)![1];
    const titled = { ...c, title: "CPU speeds" };
    assert.ok(render(table, titled, Infinity).includes(">CPU speeds</text>") && keyY(titled) > keyY(c));
});

test("padding moves everything in, the background still fills the chart", () => {
    const table = parse("x,y\n0,1\n1,2");
    const svg = render(table, { ...defaults(table), padding: 40 }, Infinity);
    assert.ok(svg.includes('<rect width="1200" height="600"') && svg.includes('<g transform="translate(40 40)">'));
});

test("the watermark is off by default and gets its own strip when on", () => {
    const table = parse("x,y\n0,1\n1,2");
    const c = defaults(table);
    assert.ok(!render(table, c, Infinity).includes("grapho.akif.kr"));
    const svg = render(table, { ...c, watermark: true }, Infinity, "", true);
    assert.ok(svg.includes(">grapho.akif.kr</text>") && svg.includes(`data-inner="1200 ${600 - c.fontSize * 1.8}"`));
});

test("bar values sit above the bar, or inside it in a colour that reads on the bar", () => {
    const table = parse("x,y\na,40\nb,90");
    const c = { ...defaults(table), type: "bar" as ChartType };
    const values = (cfg: typeof c) => [...render(table, cfg, Infinity).matchAll(/<text x="[\d.]+" y="([\d.]+)" text-anchor="middle"[^>]*fill="([^"]+)">(\d[^<]*)</g)];
    const above = values(c);
    assert.deepEqual(above.map((m) => m[3]), ["40.0", "90.0"]);
    const inside = values({ ...c, barValues: "inside" });
    assert.ok(inside.every((m, k) => +m[1] > +above[k][1] && m[2] === "#111111"), "inside, dark text on pastel bars");
    assert.equal(values({ ...c, barValues: "off" }).length, 0);
    for (const barValues of ["end", "inside"] as const) assert.ok(!render(table, { ...c, type: "hbar", barValues }, 700).includes("NaN"));
    // The tallest bar reaching the top of its axis still gets its value above it
    const full = values({ ...c, yMax: 90 });
    assert.ok(full[1][2] !== "#111111" && full[1][3] === "90.0", "outside, in the bar's colour");
    // While growing, a value that ends up inside isn't drawn outside first
    const early = { ...c, barValues: "inside" as const, anim: { ...c.anim, steps: [{ target: "y", effect: "grow" as const, ms: 1000, ease: "linear" as const, together: false }] } };
    assert.ok(values(early).length === 2 && render(table, early, 30).match(/fill="#[0-9a-f]+">\d/g) === null, "no value on a bar too short to hold it yet");
});

test("overlaid bars are the same size, biggest drawn first, and their values don't overlap", () => {
    const table = parse("x,a,b,c\nq,6,10,9.6");
    const base = { ...defaults(table), ys: ["a", "b", "c"], barLayout: "overlay" as const };
    for (const type of ["bar", "hbar"] as ChartType[]) {
        const svg = render(table, { ...base, type }, Infinity);
        const bars = [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="#(?!111)/g)].slice(0, 3).map((m) => m.slice(1).map(Number));
        const [pos, thick, long] = type === "bar" ? [0, 2, 3] : [1, 3, 2];
        assert.ok(bars.every((b) => b[pos] === bars[0][pos] && b[thick] === bars[0][thick]), `${type} same spot and size`);
        assert.ok(bars[0][long] > bars[1][long] && bars[1][long] > bars[2][long], `${type} biggest at the back: ${bars.map((b) => b[long])}`);
        // The biggest bar's value past its end in its colour, the ones in front inside their own bars
        const fill = (text: string) => svg.match(new RegExp(`fill="(#[0-9a-f]+)"[^>]*>${text}<`))![1];
        assert.ok(fill("10.0") === seriesColor(base, "b", 1) && fill("9.6") === "#111111" && fill("6.0") === "#111111", `${type} ${fill("10.0")} ${fill("9.6")}`);
        // Values inside, and 10 and 9.6 too close for both: 10 steps out past its own end, 9.6 stays inside its bar
        const tight = render(table, { ...base, type, barValues: "inside" }, Infinity);
        const where = (text: string) => tight.match(new RegExp(`<text x="([\\d.]+)" y="([\\d.]+)"[^>]*fill="(#[0-9a-f]+)"[^>]*>${text}<`))!.slice(1);
        const [at10, at96] = [where("10.0"), where("9.6")].map((p) => +p[type === "bar" ? 1 : 0]);
        // Vertical: a line apart. Horizontal: 9.6 ends inside its bar (right-aligned), 10.0 starts past the end
        assert.ok(type === "bar" ? at96 - at10 >= base.fontSize : at10 > at96, `${type} apart: ${at10} ${at96}`);
        assert.ok(where("10.0")[2] === seriesColor(base, "b", 1) && where("9.6")[2] === "#111111", `${type} 10 out in its colour, 9.6 inside`);
    }
});

test("no label runs off the edge, whatever the numbers", () => {
    const cases = ["x,a\n0,1250000\n1000000,-2500000", "t,v\n2026-11-15T17:30:43,1\n2026-11-15T17:32:43,250000", "x,v\nA very long category name,5\nAnother long one,99999"];
    for (const csv of cases)
        for (const type of ["line", "area", "bar", "scatter"] as ChartType[]) {
            const t = parse(csv);
            const c = { ...defaults(t), type, unit: " RPM", yLabel: "Y", xLabel: "X" };
            for (const cfg of [c, { ...c, compact: false }, { ...c, right: [c.ys[0]], yLabel2: "Right", unit2: " W" }, { ...c, type: "hbar" as ChartType }, { ...c, padding: 60, watermark: true }, { ...c, barValues: "inside" as const }]) {
                const svg = render(t, cfg, Infinity);
                for (const m of svg.matchAll(/<text x="([\d.-]+)"([^>]*)>([^<]+)</g)) {
                    const x = +m[1], w = m[3].length * c.fontSize * 0.62;
                    const [l, r] = m[2].includes('"end"') ? [x - w, x] : m[2].includes('"middle"') ? [x - w / 2, x + w / 2] : [x, x + w];
                    assert.ok(l >= 0 && r <= c.width, `${type} ${JSON.stringify(m[3])} spans ${Math.round(l)} to ${Math.round(r)}`);
                }
            }
        }
});

test("long data for a single date puts the names along the X axis", () => {
    const d = fresh();
    load(d, "date,category,name,percentage\n2008-11-01,AMD,1.4 Ghz,0.0036\n2008-11-01,AMD,1.5 Ghz,0.0224");
    assert.deepEqual([d.config.x, d.config.ys], ["name", ["percentage"]]);
});
