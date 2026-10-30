import { useState } from "react";

import { calculateBmi } from "../utils/bmi";

type BmiCardProps = {
  initialHeightCm: number | null;
  initialWeightKg: number | null;
};

function toInputValue(value: number | null): string {
  return value === null ? "" : value.toString();
}

function getBmi(weightValue: string, heightValue: string): number | null {
  const weight = Number(weightValue);
  const height = Number(heightValue);

  if (
    !Number.isFinite(weight) ||
    !Number.isFinite(height) ||
    weight <= 0 ||
    height <= 0
  ) {
    return null;
  }

  return calculateBmi(weight, height);
}

export function BmiCard({ initialHeightCm, initialWeightKg }: BmiCardProps) {
  const [heightCm, setHeightCm] = useState(() => toInputValue(initialHeightCm));
  const [weightKg, setWeightKg] = useState(() => toInputValue(initialWeightKg));
  const bmi = getBmi(weightKg, heightCm);

  return (
    <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
            BMI calculator
          </p>
          <h2 className="mt-2 text-xl font-semibold">
            Your current calculation
          </h2>
        </div>
        <output
          className="text-3xl font-bold tabular-nums text-emerald-300"
          aria-live="polite"
        >
          {bmi === null ? "—" : bmi.toFixed(1)}
        </output>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <BmiField
          id="bmi-height"
          label="Height (cm)"
          value={heightCm}
          onChange={setHeightCm}
        />
        <BmiField
          id="bmi-weight"
          label="Weight (kg)"
          value={weightKg}
          onChange={setWeightKg}
        />
      </div>

      <dl className="mt-5 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
        <div>
          <dt className="text-slate-400">Entered height</dt>
          <dd className="mt-1 font-medium text-slate-100">
            {heightCm || "Not entered"}
            {heightCm ? " cm" : ""}
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">Entered weight</dt>
          <dd className="mt-1 font-medium text-slate-100">
            {weightKg || "Not entered"}
            {weightKg ? " kg" : ""}
          </dd>
        </div>
      </dl>

      {bmi === null && (heightCm || weightKg) && (
        <p className="mt-4 text-sm text-amber-200" role="status">
          Enter positive numeric height and weight values to calculate BMI.
        </p>
      )}
      <p className="mt-5 text-sm leading-6 text-slate-400">
        BMI is an informational fitness metric and is not a medical diagnosis.
      </p>
    </section>
  );
}

function BmiField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      <input
        className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30"
        id={id}
        inputMode="decimal"
        min="0.1"
        step="0.1"
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
