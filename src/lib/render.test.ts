import assert from "node:assert/strict";
import { test } from "node:test";
import { parse, smooth } from "./data.ts";
import { clip, compact, defaults, render, seriesColor, stack, type ChartType } from "./render.ts";
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
    assert.ok(parse('{"a":1}').error);
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

test("every chart type renders at every point in time without NaN", () => {
    const table = parse("day,x,y\nMon,1,5\nTue,2,\nWed,3,-2\nThu,4,8");
    for (const type of ["line", "area", "bar", "scatter", "pie"] as ChartType[]) {
        const c = { ...defaults(table), type, x: "day", ys: ["x", "y"] };
        c.anim.rescale = true;
        for (const t of [0, 400, 1200, 2500, 99999]) {
            const svg = render(table, c, t);
            assert.ok(svg.startsWith("<svg") && !svg.includes("NaN") && !svg.includes("undefined"), `${type} @ ${t}`);
            assert.ok(type === "pie" || !/[ ,ML]-\d{3,}/.test(svg), `${type} @ ${t} draws outside the chart`);
        }
    }
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

test("no label runs off the edge, whatever the numbers", () => {
    const cases = ["x,a\n0,1250000\n1000000,-2500000", "t,v\n2026-11-15T17:30:43,1\n2026-11-15T17:32:43,250000", "x,v\nA very long category name,5\nAnother long one,99999"];
    for (const csv of cases)
        for (const type of ["line", "area", "bar", "scatter"] as ChartType[]) {
            const t = parse(csv);
            const c = { ...defaults(t), type, unit: " RPM", yLabel: "Y", xLabel: "X" };
            for (const cfg of [c, { ...c, right: [c.ys[0]], yLabel2: "Right", unit2: " W" }]) {
                const svg = render(t, cfg, Infinity);
                for (const m of svg.matchAll(/<text x="([\d.-]+)"([^>]*)>([^<]+)</g)) {
                    const x = +m[1], w = m[3].length * c.fontSize * 0.62;
                    const [l, r] = m[2].includes('"end"') ? [x - w, x] : m[2].includes('"middle"') ? [x - w / 2, x + w / 2] : [x, x + w];
                    assert.ok(l >= 0 && r <= c.width, `${type} ${JSON.stringify(m[3])} spans ${Math.round(l)} to ${Math.round(r)}`);
                }
            }
        }
});
