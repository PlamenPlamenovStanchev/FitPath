import { strict as assert } from "node:assert";
import test from "node:test";

import { calculateBmi } from "./bmi.ts";

test("calculates BMI for 80 kg and 180 cm", () => {
  assert.equal(calculateBmi(80, 180), 24.7);
});

test("rounds decimal BMI values to one decimal place", () => {
  assert.equal(calculateBmi(65.5, 172.5), 22);
});

test("rejects zero height", () => {
  assert.throws(() => calculateBmi(80, 0), RangeError);
});

test("rejects negative weight", () => {
  assert.throws(() => calculateBmi(-80, 180), RangeError);
});

test("rejects invalid numeric values", () => {
  assert.throws(() => calculateBmi(Number.NaN, 180), RangeError);
  assert.throws(() => calculateBmi(80, Number.POSITIVE_INFINITY), RangeError);
});
