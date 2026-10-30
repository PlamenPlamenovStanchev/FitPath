import { useState } from "react";

import {
  ApiRequestError,
  type ActivityLevel,
  type FitnessGoal,
  type OnboardingPayload,
  type OnboardingResponse,
} from "../api/client";

type FormValues = {
  age: string;
  heightCm: string;
  currentWeightKg: string;
  activityLevel: ActivityLevel | "";
  fitnessGoal: FitnessGoal | "";
};

type FieldName = keyof FormValues;
type FieldErrors = Partial<Record<FieldName, string>>;

type OnboardingWizardProps = {
  completeOnboarding: (
    payload: OnboardingPayload,
  ) => Promise<OnboardingResponse>;
  onCompleted: (response: OnboardingResponse) => void;
};

const activityOptions: ReadonlyArray<{ value: ActivityLevel; label: string }> =
  [
    { value: "SEDENTARY", label: "Sedentary" },
    { value: "LIGHTLY_ACTIVE", label: "Lightly active" },
    { value: "MODERATELY_ACTIVE", label: "Moderately active" },
    { value: "VERY_ACTIVE", label: "Very active" },
  ];

const goalOptions: ReadonlyArray<{ value: FitnessGoal; label: string }> = [
  { value: "LOSE_WEIGHT", label: "Lose weight" },
  { value: "BUILD_MUSCLE", label: "Build muscle" },
  { value: "IMPROVE_FITNESS", label: "Improve fitness" },
  { value: "MAINTAIN_CONDITION", label: "Maintain current condition" },
];

function validateStep(step: number, values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  const age = Number(values.age);
  const height = Number(values.heightCm);
  const weight = Number(values.currentWeightKg);

  if (step === 1) {
    if (!Number.isInteger(age) || age < 13 || age > 120) {
      errors.age = "Enter an age from 13 to 120.";
    }
    if (!Number.isFinite(height) || height < 50 || height > 300) {
      errors.heightCm = "Enter a height from 50 to 300 cm.";
    }
    if (!Number.isFinite(weight) || weight < 20 || weight > 500) {
      errors.currentWeightKg = "Enter a weight from 20 to 500 kg.";
    }
  }

  if (step === 2 && !values.activityLevel) {
    errors.activityLevel = "Choose your usual activity level.";
  }

  if (step === 3 && !values.fitnessGoal) {
    errors.fitnessGoal = "Choose a fitness goal.";
  }

  return errors;
}

export function OnboardingWizard({
  completeOnboarding,
  onCompleted,
}: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [values, setValues] = useState<FormValues>({
    age: "",
    heightCm: "",
    currentWeightKg: "",
    activityLevel: "",
    fitnessGoal: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function setField(name: FieldName, value: string): void {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setServerError(null);
  }

  function continueToNextStep(): void {
    const nextErrors = validateStep(step, values);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setStep((current) => current + 1);
  }

  async function submit(): Promise<void> {
    const nextErrors = validateStep(3, values);
    if (
      Object.keys(nextErrors).length > 0 ||
      !values.activityLevel ||
      !values.fitnessGoal
    ) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    setServerError(null);

    try {
      const onboardingResponse = await completeOnboarding({
        age: Number(values.age),
        heightCm: Number(values.heightCm),
        currentWeightKg: Number(values.currentWeightKg),
        activityLevel: values.activityLevel,
        fitnessGoal: values.fitnessGoal,
      });
      onCompleted(onboardingResponse);
    } catch (error: unknown) {
      setServerError(
        error instanceof ApiRequestError
          ? error.message
          : "We could not complete onboarding. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 sm:py-12">
      <section className="mx-auto max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-slate-950/30 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">
          Welcome to FitPath
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          Let&apos;s personalize your path
        </h1>
        <p className="mt-3 text-slate-300">
          A few details will help us get your profile ready.
        </p>

        <div className="mt-8" aria-label={`Step ${step} of 3`}>
          <div className="flex justify-between text-sm text-slate-400">
            <span>Step {step} of 3</span>
            <span>
              {step === 1
                ? "Personal information"
                : step === 2
                  ? "Activity level"
                  : "Fitness goal"}
            </span>
          </div>
          <div className="mt-3 flex gap-2" aria-hidden="true">
            {[1, 2, 3].map((number) => (
              <div
                className={`h-2 flex-1 rounded-full ${number <= step ? "bg-emerald-400" : "bg-slate-700"}`}
                key={number}
              />
            ))}
          </div>
        </div>

        {serverError && (
          <p
            className="mt-6 rounded-md border border-rose-900 bg-rose-950/50 px-4 py-3 text-rose-200"
            role="alert"
          >
            {serverError}
          </p>
        )}

        <div className="mt-8">
          {step === 1 && (
            <div className="grid gap-5">
              <NumberField
                label="Age"
                name="age"
                value={values.age}
                error={errors.age}
                onChange={setField}
                min="13"
                max="120"
                step="1"
              />
              <NumberField
                label="Height (cm)"
                name="heightCm"
                value={values.heightCm}
                error={errors.heightCm}
                onChange={setField}
                min="50"
                max="300"
                step="0.01"
              />
              <NumberField
                label="Current weight (kg)"
                name="currentWeightKg"
                value={values.currentWeightKg}
                error={errors.currentWeightKg}
                onChange={setField}
                min="20"
                max="500"
                step="0.01"
              />
            </div>
          )}

          {step === 2 && (
            <fieldset>
              <legend className="text-lg font-semibold">
                How active are you?
              </legend>
              <p className="mt-2 text-sm text-slate-400">
                Choose the option that best describes most weeks.
              </p>
              <div className="mt-5 grid gap-3">
                {activityOptions.map((option) => (
                  <Option
                    key={option.value}
                    name="activityLevel"
                    option={option}
                    selected={values.activityLevel}
                    onChange={setField}
                  />
                ))}
              </div>
              {errors.activityLevel && (
                <p className="mt-3 text-sm text-rose-300" role="alert">
                  {errors.activityLevel}
                </p>
              )}
            </fieldset>
          )}

          {step === 3 && (
            <fieldset>
              <legend className="text-lg font-semibold">
                What is your main goal?
              </legend>
              <p className="mt-2 text-sm text-slate-400">
                You can update this later as your goals change.
              </p>
              <div className="mt-5 grid gap-3">
                {goalOptions.map((option) => (
                  <Option
                    key={option.value}
                    name="fitnessGoal"
                    option={option}
                    selected={values.fitnessGoal}
                    onChange={setField}
                  />
                ))}
              </div>
              {errors.fitnessGoal && (
                <p className="mt-3 text-sm text-rose-300" role="alert">
                  {errors.fitnessGoal}
                </p>
              )}
            </fieldset>
          )}
        </div>

        <div className="mt-8 flex items-center justify-between gap-4 border-t border-slate-800 pt-6">
          {step > 1 ? (
            <button
              className="rounded-md px-4 py-2 font-semibold text-slate-200 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
              type="button"
              onClick={() => setStep((current) => current - 1)}
              disabled={isSubmitting}
            >
              Back
            </button>
          ) : (
            <span />
          )}
          {step < 3 ? (
            <button
              className="rounded-md bg-emerald-400 px-4 py-2 font-semibold text-slate-950 hover:bg-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
              type="button"
              onClick={continueToNextStep}
            >
              Continue
            </button>
          ) : (
            <button
              className="rounded-md bg-emerald-400 px-4 py-2 font-semibold text-slate-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
              type="button"
              onClick={() => void submit()}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Completing…" : "Complete onboarding"}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

function NumberField({
  label,
  name,
  value,
  error,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  name: "age" | "heightCm" | "currentWeightKg";
  value: string;
  error?: string;
  onChange: (name: FieldName, value: string) => void;
  min: string;
  max: string;
  step: string;
}) {
  const id = `onboarding-${name}`;
  return (
    <div>
      <label className="block text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      <input
        className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30"
        id={id}
        type="number"
        inputMode="decimal"
        value={value}
        min={min}
        max={max}
        step={step}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(name, event.target.value)}
      />
      {error && (
        <p
          className="mt-2 text-sm text-rose-300"
          id={`${id}-error`}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function Option({
  name,
  option,
  selected,
  onChange,
}: {
  name: "activityLevel" | "fitnessGoal";
  option: { value: ActivityLevel | FitnessGoal; label: string };
  selected: string;
  onChange: (name: FieldName, value: string) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 transition hover:border-slate-500 has-[:checked]:border-emerald-400 has-[:checked]:bg-emerald-400/10">
      <input
        className="h-4 w-4 accent-emerald-400"
        type="radio"
        name={name}
        value={option.value}
        checked={selected === option.value}
        onChange={(event) => onChange(name, event.target.value)}
      />
      {option.label}
    </label>
  );
}
