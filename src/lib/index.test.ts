import assert from "node:assert/strict";
import { test } from "node:test";
import { chart, svg } from "./index.ts";

test("chart reads text, rows and columns the same way", () => {
    const fromCsv = chart("day,a,b\n1,10,20\n2,15,25").table.rows;
    assert.deepEqual(chart([{ day: 1, a: 10, b: 20 }, { day: 2, a: 15, b: 25 }]).table.rows, fromCsv);
    assert.deepEqual(chart({ day: [1, 2], a: [10, 15], b: [20, 25] }).table.rows, fromCsv);
    assert.ok(chart([{ when: new Date("2026-01-01T00:00:00Z"), v: 1 }]).table.rows[0].when instanceof Date);
    assert.throws(() => chart("[1,"), /Not valid JSON/);
});

test("chart fills in what the options leave out", () => {
    const { config } = chart("day,a,b\n1,10,20\n2,15,25", { ys: ["b"], colors: { background: "#ffffff" }, width: undefined });
    assert.equal(config.width, 1200);
    assert.equal(config.colors.text, "#a3a3a3");
    assert.equal(config.yLabel, "b");
    assert.deepEqual(config.anim.steps.map((s) => s.target), ["axes", "b"]);
});

test("chart splits long data before picking series", () => {
    const { config } = chart("day,name,v\n1,x,1\n1,y,2\n2,x,3\n2,y,4", { reshape: { splitBy: "name", value: "v" } });
    assert.deepEqual(config.ys, ["x", "y"]);
});

test("svg renders without a DOM", () => {
    const out = svg("day,a\n1,10\n2,15", { type: "bar", title: "Hi" });
    assert.match(out, /^<svg[^>]*viewBox="0 0 1200 600"/);
    assert.match(out, />Hi</);
});
