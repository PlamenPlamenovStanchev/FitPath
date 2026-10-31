import { useEffect, useState } from "react";

import {
  ApiRequestError,
  type FitPathUser,
  type TrainerClientsResponse,
  type TrainingPlan,
  type TrainingPlanPayload,
  type TrainingPlanStatus,
  type TrainingPlansResponse,
} from "../api/client";

type DraftExercise = {
  key: string;
  name: string;
  sets: string;
  repetitions: string;
  weightKg: string;
  restSeconds: string;
  notes: string;
};

type DraftWorkoutDay = {
  key: string;
  name: string;
  exercises: DraftExercise[];
};

type DraftPlan = {
  title: string;
  goal: string;
  startDate: string;
  endDate: string;
  status: TrainingPlanStatus;
  clientUserId: string;
  workoutDays: DraftWorkoutDay[];
};

type TrainingPlanEditorPageProps = {
  user: FitPathUser;
  getPlans: (signal?: AbortSignal) => Promise<TrainingPlansResponse>;
  getPlan: (planId: string, signal?: AbortSignal) => Promise<TrainingPlan>;
  createPlan: (payload: TrainingPlanPayload) => Promise<TrainingPlan>;
  updatePlan: (planId: string, payload: TrainingPlanPayload) => Promise<TrainingPlan>;
  getTrainerClients: (signal?: AbortSignal) => Promise<TrainerClientsResponse>;
  downloadPlanPdf: (planId: string) => Promise<Blob>;
};

function newExercise(): DraftExercise {
  return {
    key: crypto.randomUUID(),
    name: "",
    sets: "3",
    repetitions: "10",
    weightKg: "",
    restSeconds: "",
    notes: "",
  };
}

function newWorkoutDay(): DraftWorkoutDay {
  return { key: crypto.randomUUID(), name: "", exercises: [newExercise()] };
}

function newPlan(clientUserId = ""): DraftPlan {
  return {
    title: "",
    goal: "",
    startDate: "",
    endDate: "",
    status: "DRAFT",
    clientUserId,
    workoutDays: [newWorkoutDay()],
  };
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;

  if (target < 0 || target >= items.length) {
    return items;
  }

  const next = [...items];
  const current = next[index];
  const replacement = next[target];

  if (current === undefined || replacement === undefined) {
    return items;
  }

  next[index] = replacement;
  next[target] = current;
  return next;
}

function toDraft(plan: TrainingPlan): DraftPlan {
  return {
    title: plan.title,
    goal: plan.goal,
    startDate: plan.startDate,
    endDate: plan.endDate,
    status: plan.status,
    clientUserId: plan.clientUserId,
    workoutDays: plan.workoutDays.map((day) => ({
      key: day.id,
      name: day.name,
      exercises: day.exercises.map((exercise) => ({
        key: exercise.workoutExerciseId,
        name: exercise.name,
        sets: String(exercise.sets),
        repetitions: String(exercise.repetitions),
        weightKg: exercise.weightKg ?? "",
        restSeconds: exercise.restSeconds === null ? "" : String(exercise.restSeconds),
        notes: exercise.notes ?? "",
      })),
    })),
  };
}

function draftToPayload(draft: DraftPlan, includeClientUserId: boolean): TrainingPlanPayload {
  return {
    title: draft.title.trim(),
    goal: draft.goal.trim(),
    startDate: draft.startDate,
    endDate: draft.endDate,
    status: draft.status,
    ...(includeClientUserId ? { clientUserId: draft.clientUserId } : {}),
    workoutDays: draft.workoutDays.map((day, dayIndex) => ({
      name: day.name.trim(),
      position: dayIndex + 1,
      exercises: day.exercises.map((exercise, exerciseIndex) => ({
        name: exercise.name.trim(),
        sets: Number(exercise.sets),
        repetitions: Number(exercise.repetitions),
        weightKg: exercise.weightKg === "" ? null : Number(exercise.weightKg),
        restSeconds: exercise.restSeconds === "" ? null : Number(exercise.restSeconds),
        notes: exercise.notes.trim() || null,
        position: exerciseIndex + 1,
      })),
    })),
  };
}

function validateDraft(draft: DraftPlan, needsClient: boolean): string | null {
  if (!draft.title.trim() || !draft.goal.trim()) {
    return "Title and goal are required.";
  }

  if (!draft.startDate || !draft.endDate || draft.endDate < draft.startDate) {
    return "Provide valid dates with an end date on or after the start date.";
  }

  if (needsClient && !draft.clientUserId) {
    return "Choose an assigned client before saving.";
  }

  for (const day of draft.workoutDays) {
    if (!day.name.trim()) {
      return "Every workout day needs a name.";
    }

    for (const exercise of day.exercises) {
      if (!exercise.name.trim()) {
        return "Every exercise needs a name.";
      }

      if (!Number.isInteger(Number(exercise.sets)) || Number(exercise.sets) <= 0) {
        return "Exercise sets must be positive whole numbers.";
      }

      if (!Number.isInteger(Number(exercise.repetitions)) || Number(exercise.repetitions) <= 0) {
        return "Exercise repetitions must be positive whole numbers.";
      }

      if (exercise.weightKg && (!Number.isFinite(Number(exercise.weightKg)) || Number(exercise.weightKg) < 0)) {
        return "Exercise weight cannot be negative.";
      }

      if (exercise.restSeconds && (!Number.isInteger(Number(exercise.restSeconds)) || Number(exercise.restSeconds) < 0)) {
        return "Rest time must be a non-negative whole number.";
      }
    }
  }

  return null;
}

export function TrainingPlanEditorPage({
  user,
  getPlans,
  getPlan,
  createPlan,
  updatePlan,
  getTrainerClients,
  downloadPlanPdf,
}: TrainingPlanEditorPageProps) {
  const [plans, setPlans] = useState<TrainingPlansResponse["plans"]>([]);
  const [clients, setClients] = useState<TrainerClientsResponse["clients"]>([]);
  const [draft, setDraft] = useState(() => newPlan());
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const clientRequest = user.role === "TRAINER"
      ? getTrainerClients(controller.signal)
      : Promise.resolve({ clients: [] });

    void Promise.all([getPlans(controller.signal), clientRequest])
      .then(([plansResponse, clientsResponse]) => {
        if (!controller.signal.aborted) {
          setPlans(plansResponse.plans);
          setClients(clientsResponse.clients);
        }
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            requestError instanceof ApiRequestError
              ? requestError.message
              : "We could not load training plans.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [getPlans, getTrainerClients, user.role]);

  function startNewPlan() {
    setEditingPlanId(null);
    setDraft(newPlan());
    setError(null);
    setSaveMessage(null);
  }

  async function editPlan(planId: string) {
    setError(null);
    setSaveMessage(null);
    setIsLoadingPlan(true);

    try {
      const plan = await getPlan(planId);
      setEditingPlanId(plan.id);
      setDraft(toDraft(plan));
    } catch (requestError) {
      setError(
        requestError instanceof ApiRequestError
          ? requestError.message
          : "We could not load this training plan.",
      );
    } finally {
      setIsLoadingPlan(false);
    }
  }

  function updateDay(dayIndex: number, updater: (day: DraftWorkoutDay) => DraftWorkoutDay) {
    setDraft((current) => ({
      ...current,
      workoutDays: current.workoutDays.map((day, index) =>
        index === dayIndex ? updater(day) : day,
      ),
    }));
  }

  function updateExercise(
    dayIndex: number,
    exerciseIndex: number,
    updater: (exercise: DraftExercise) => DraftExercise,
  ) {
    updateDay(dayIndex, (day) => ({
      ...day,
      exercises: day.exercises.map((exercise, index) =>
        index === exerciseIndex ? updater(exercise) : exercise,
      ),
    }));
  }

  async function savePlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const needsClient = user.role === "TRAINER" && !editingPlanId;
    const validationError = validateDraft(draft, needsClient);

    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSaveMessage(null);
    setIsSaving(true);

    try {
      const payload = draftToPayload(
        draft,
        user.role === "TRAINER" || (user.role === "ADMIN" && Boolean(draft.clientUserId)),
      );
      const savedPlan = editingPlanId
        ? await updatePlan(editingPlanId, payload)
        : await createPlan(payload);

      setEditingPlanId(savedPlan.id);
      setDraft(toDraft(savedPlan));
      setPlans((current) => {
        const summary = { ...savedPlan };
        delete (summary as Partial<TrainingPlan>).workoutDays;
        const withoutSaved = current.filter((plan) => plan.id !== savedPlan.id);
        return [...withoutSaved, summary as TrainingPlansResponse["plans"][number]];
      });
      setSaveMessage("Training plan saved.");
    } catch (requestError) {
      setError(
        requestError instanceof ApiRequestError
          ? requestError.message
          : "We could not save this training plan.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function downloadPdf() {
    if (!editingPlanId || isDownloadingPdf) {
      return;
    }

    setError(null);
    setSaveMessage(null);
    setIsDownloadingPdf(true);

    try {
      const pdf = await downloadPlanPdf(editingPlanId);
      const objectUrl = URL.createObjectURL(pdf);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `fitpath-training-plan-${editingPlanId}.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch (requestError) {
      setError(
        requestError instanceof ApiRequestError
          ? requestError.message
          : "We could not download this training plan PDF.",
      );
    } finally {
      setIsDownloadingPdf(false);
    }
  }

  return (
    <section className="py-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Training plans
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">Plan editor</h2>
          <p className="mt-3 max-w-2xl text-slate-300">
            Build a structured training plan with ordered workout days and exercises.
          </p>
        </div>
        <button className="rounded-md border border-slate-600 px-4 py-2 font-semibold hover:border-slate-300 hover:bg-slate-800" type="button" onClick={startNewPlan}>
          New plan
        </button>
      </div>

      {error && <p className="mt-6 text-sm text-rose-300" role="alert">{error}</p>}
      {saveMessage && <p className="mt-6 text-sm text-emerald-300" role="status">{saveMessage}</p>}

      {isLoading ? (
        <p className="mt-8 text-slate-300" aria-live="polite">Loading training plans…</p>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <aside className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h3 className="font-semibold">Available plans</h3>
            {plans.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">No plans yet.</p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {plans.map((plan) => (
                  <li key={plan.id}>
                    <button
                      className={`w-full rounded-md px-3 py-3 text-left text-sm transition ${editingPlanId === plan.id ? "bg-emerald-400 text-slate-950" : "bg-slate-950 text-slate-200 hover:bg-slate-800"}`}
                      type="button"
                      disabled={isLoadingPlan}
                      onClick={() => void editPlan(plan.id)}
                    >
                      <span className="block font-semibold">{plan.title}</span>
                      <span className="mt-1 block text-xs opacity-75">{plan.status}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <form className="rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-6" onSubmit={(event) => void savePlan(event)}>
            {isLoadingPlan ? (
              <p className="text-slate-300" aria-live="polite">Loading plan editor…</p>
            ) : (
              <>
                <div className="grid gap-5 sm:grid-cols-2">
                  <TextField label="Plan title" value={draft.title} onChange={(value) => setDraft((current) => ({ ...current, title: value }))} />
                  <TextField label="Goal" value={draft.goal} onChange={(value) => setDraft((current) => ({ ...current, goal: value }))} />
                  <DateField label="Start date" value={draft.startDate} onChange={(value) => setDraft((current) => ({ ...current, startDate: value }))} />
                  <DateField label="End date" value={draft.endDate} onChange={(value) => setDraft((current) => ({ ...current, endDate: value }))} />
                  <label className="block text-sm font-medium">
                    Status
                    <select className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as TrainingPlanStatus }))}>
                      <option value="DRAFT">Draft</option>
                      <option value="ACTIVE">Active</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  </label>
                  {user.role === "TRAINER" && !editingPlanId && (
                    <label className="block text-sm font-medium">
                      Assigned client
                      <select className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" value={draft.clientUserId} onChange={(event) => setDraft((current) => ({ ...current, clientUserId: event.target.value }))}>
                        <option value="">Choose a client</option>
                        {clients.map((client) => <option key={client.userId} value={client.userId}>{client.clientId}</option>)}
                      </select>
                    </label>
                  )}
                </div>

                <div className="mt-8 border-t border-slate-800 pt-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-xl font-semibold">Workout days</h3>
                    <button className="rounded-md border border-emerald-400 px-3 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-400/10" type="button" onClick={() => setDraft((current) => ({ ...current, workoutDays: [...current.workoutDays, newWorkoutDay()] }))}>
                      Add workout day
                    </button>
                  </div>

                  <div className="mt-5 grid gap-5">
                    {draft.workoutDays.map((day, dayIndex) => (
                      <section className="rounded-lg border border-slate-700 bg-slate-950/60 p-4" key={day.key}>
                        <div className="flex flex-wrap items-end justify-between gap-3">
                          <div className="min-w-52 flex-1">
                            <TextField label={`Day ${dayIndex + 1} name`} value={day.name} onChange={(value) => updateDay(dayIndex, (current) => ({ ...current, name: value }))} />
                          </div>
                          <div className="flex gap-2">
                            <OrderButton label="Move day up" disabled={dayIndex === 0} onClick={() => setDraft((current) => ({ ...current, workoutDays: moveItem(current.workoutDays, dayIndex, -1) }))}>↑</OrderButton>
                            <OrderButton label="Move day down" disabled={dayIndex === draft.workoutDays.length - 1} onClick={() => setDraft((current) => ({ ...current, workoutDays: moveItem(current.workoutDays, dayIndex, 1) }))}>↓</OrderButton>
                            <OrderButton label="Remove workout day" disabled={false} onClick={() => setDraft((current) => ({ ...current, workoutDays: current.workoutDays.filter((_, index) => index !== dayIndex) }))}>Remove</OrderButton>
                          </div>
                        </div>

                        <div className="mt-5 border-t border-slate-800 pt-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <h4 className="font-semibold">Exercises</h4>
                            <button className="rounded-md border border-slate-600 px-3 py-2 text-sm font-semibold hover:border-slate-300 hover:bg-slate-800" type="button" onClick={() => updateDay(dayIndex, (current) => ({ ...current, exercises: [...current.exercises, newExercise()] }))}>Add exercise</button>
                          </div>
                          <div className="mt-4 grid gap-4">
                            {day.exercises.map((exercise, exerciseIndex) => (
                              <section className="rounded-md border border-slate-800 p-4" key={exercise.key}>
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                  <TextField label="Exercise name" value={exercise.name} onChange={(value) => updateExercise(dayIndex, exerciseIndex, (current) => ({ ...current, name: value }))} />
                                  <NumberField label="Sets" min="1" value={exercise.sets} onChange={(value) => updateExercise(dayIndex, exerciseIndex, (current) => ({ ...current, sets: value }))} />
                                  <NumberField label="Repetitions" min="1" value={exercise.repetitions} onChange={(value) => updateExercise(dayIndex, exerciseIndex, (current) => ({ ...current, repetitions: value }))} />
                                  <NumberField label="Weight (kg)" min="0" step="0.01" value={exercise.weightKg} onChange={(value) => updateExercise(dayIndex, exerciseIndex, (current) => ({ ...current, weightKg: value }))} />
                                  <NumberField label="Rest (seconds)" min="0" value={exercise.restSeconds} onChange={(value) => updateExercise(dayIndex, exerciseIndex, (current) => ({ ...current, restSeconds: value }))} />
                                  <TextField label="Notes" value={exercise.notes} onChange={(value) => updateExercise(dayIndex, exerciseIndex, (current) => ({ ...current, notes: value }))} />
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2">
                                  <OrderButton label="Move exercise up" disabled={exerciseIndex === 0} onClick={() => updateDay(dayIndex, (current) => ({ ...current, exercises: moveItem(current.exercises, exerciseIndex, -1) }))}>↑ Move up</OrderButton>
                                  <OrderButton label="Move exercise down" disabled={exerciseIndex === day.exercises.length - 1} onClick={() => updateDay(dayIndex, (current) => ({ ...current, exercises: moveItem(current.exercises, exerciseIndex, 1) }))}>↓ Move down</OrderButton>
                                  <OrderButton label="Remove exercise" disabled={false} onClick={() => updateDay(dayIndex, (current) => ({ ...current, exercises: current.exercises.filter((_, index) => index !== exerciseIndex) }))}>Remove</OrderButton>
                                </div>
                              </section>
                            ))}
                          </div>
                        </div>
                      </section>
                    ))}
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  <button className="rounded-md bg-emerald-400 px-4 py-2 font-semibold text-slate-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={isSaving || isDownloadingPdf}>
                    {isSaving ? "Saving…" : editingPlanId ? "Save changes" : "Create plan"}
                  </button>
                  {editingPlanId && (
                    <button className="rounded-md border border-slate-500 px-4 py-2 font-semibold text-slate-100 hover:border-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60" type="button" disabled={isSaving || isDownloadingPdf} onClick={() => void downloadPdf()}>
                      {isDownloadingPdf ? "Preparing PDF…" : "Download PDF"}
                    </button>
                  )}
                </div>
              </>
            )}
          </form>
        </div>
      )}
    </section>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-medium">{label}<input className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-medium">{label}<input className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" type="date" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function NumberField({ label, min, step, value, onChange }: { label: string; min: string; step?: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-medium">{label}<input className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" type="number" min={min} step={step} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function OrderButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button className="rounded-md border border-slate-600 px-3 py-2 text-sm hover:border-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40" type="button" aria-label={label} disabled={disabled} onClick={onClick}>{children}</button>;
}
