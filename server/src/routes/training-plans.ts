import { randomUUID } from "node:crypto";

import { and, asc, eq, inArray } from "drizzle-orm";
import { Router } from "express";

import {
  getAuthenticatedClerkUserId,
  requireAuthenticatedUser,
} from "../auth/authentication.js";
import { db } from "../db/client.js";
import {
  exercises,
  trainerAssignments,
  trainingPlans,
  users,
  workoutDays,
  workoutExercises,
} from "../db/schema.js";

const trainingPlansRouter = Router();

const trainingPlanStatuses = ["DRAFT", "ACTIVE", "COMPLETED"] as const;
type TrainingPlanStatus = (typeof trainingPlanStatuses)[number];
type FitPathRole = "USER" | "TRAINER" | "ADMIN";

type PlanExerciseInput = {
  name: string;
  description: string | null;
  sets: number;
  repetitions: number;
  weightKg: number | null;
  restSeconds: number | null;
  notes: string | null;
  position: number;
};

type WorkoutDayInput = {
  name: string;
  position: number;
  exercises: PlanExerciseInput[];
};

type TrainingPlanInput = {
  title: string;
  goal: string;
  startDate: string;
  endDate: string;
  status: TrainingPlanStatus;
  clientUserId: string | null;
  workoutDays: WorkoutDayInput[];
};

type LocalUser = { id: string; role: FitPathRole };

const planFields = {
  id: trainingPlans.id,
  title: trainingPlans.title,
  goal: trainingPlans.goal,
  clientUserId: trainingPlans.clientUserId,
  createdByUserId: trainingPlans.createdByUserId,
  startDate: trainingPlans.startDate,
  endDate: trainingPlans.endDate,
  status: trainingPlans.status,
  createdAt: trainingPlans.createdAt,
  updatedAt: trainingPlans.updatedAt,
};

function normalizeExerciseName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function parseRequiredText(
  value: unknown,
  label: string,
  maximumLength: number,
): { value: string } | { error: string } {
  if (typeof value !== "string") {
    return { error: `${label} is required.` };
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return { error: `${label} cannot be blank.` };
  }

  if (trimmed.length > maximumLength) {
    return { error: `${label} must be ${maximumLength} characters or fewer.` };
  }

  return { value: trimmed };
}

function parseOptionalText(
  value: unknown,
  label: string,
  maximumLength: number,
): { value: string | null } | { error: string } {
  if (value === undefined || value === null) {
    return { value: null };
  }

  if (typeof value !== "string") {
    return { error: `${label} must be text.` };
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return { value: null };
  }

  if (trimmed.length > maximumLength) {
    return { error: `${label} must be ${maximumLength} characters or fewer.` };
  }

  return { value: trimmed };
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isPositiveSmallInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 32_767;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function parseExercise(value: unknown): { value: PlanExerciseInput } | { error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Each exercise must be an object." };
  }

  const input = value as Record<string, unknown>;
  const name = parseRequiredText(input.name, "Exercise name", 160);
  const description = parseOptionalText(input.description, "Exercise description", 1_000);
  const notes = parseOptionalText(input.notes, "Exercise notes", 1_000);

  if ("error" in name) {
    return name;
  }

  if ("error" in description) {
    return description;
  }

  if ("error" in notes) {
    return notes;
  }

  if (!isPositiveSmallInteger(input.sets)) {
    return { error: "Exercise sets must be a positive integer." };
  }

  if (!isPositiveSmallInteger(input.repetitions)) {
    return { error: "Exercise repetitions must be a positive integer." };
  }

  if (input.weightKg !== undefined && input.weightKg !== null) {
    if (!isNonNegativeFiniteNumber(input.weightKg) || input.weightKg > 9_999.99) {
      return { error: "Exercise weight must be between 0 and 9999.99 kilograms." };
    }
  }

  if (input.restSeconds !== undefined && input.restSeconds !== null) {
    if (
      !isNonNegativeFiniteNumber(input.restSeconds) ||
      !Number.isInteger(input.restSeconds) ||
      input.restSeconds > 2_147_483_647
    ) {
      return { error: "Exercise rest time must be a non-negative integer." };
    }
  }

  if (!isPositiveSmallInteger(input.position)) {
    return { error: "Exercise position must be a positive integer." };
  }

  return {
    value: {
      name: name.value,
      description: description.value,
      sets: input.sets,
      repetitions: input.repetitions,
      weightKg: (input.weightKg as number | null | undefined) ?? null,
      restSeconds: (input.restSeconds as number | null | undefined) ?? null,
      notes: notes.value,
      position: input.position,
    },
  };
}

function parseTrainingPlanInput(value: unknown):
  | { value: TrainingPlanInput }
  | { error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "A valid training plan payload is required." };
  }

  const input = value as Record<string, unknown>;
  const title = parseRequiredText(input.title, "Plan title", 160);
  const goal = parseRequiredText(input.goal, "Plan goal", 500);

  if ("error" in title) {
    return title;
  }

  if ("error" in goal) {
    return goal;
  }

  if (!isValidDate(input.startDate) || !isValidDate(input.endDate)) {
    return { error: "Start date and end date must be valid ISO dates." };
  }

  if (input.endDate < input.startDate) {
    return { error: "End date must not be before start date." };
  }

  if (
    typeof input.status !== "string" ||
    !trainingPlanStatuses.includes(input.status as TrainingPlanStatus)
  ) {
    return { error: "Training plan status is invalid." };
  }

  if (input.clientUserId !== undefined && input.clientUserId !== null && !isUuid(input.clientUserId)) {
    return { error: "Client user ID must be a valid UUID." };
  }

  if (!Array.isArray(input.workoutDays)) {
    return { error: "Workout days must be an array." };
  }

  const dayPositions = new Set<number>();
  const workoutDays: WorkoutDayInput[] = [];

  for (const day of input.workoutDays) {
    if (!day || typeof day !== "object" || Array.isArray(day)) {
      return { error: "Each workout day must be an object." };
    }

    const dayInput = day as Record<string, unknown>;
    const name = parseRequiredText(dayInput.name, "Workout day name", 120);

    if ("error" in name) {
      return name;
    }

    if (!isPositiveSmallInteger(dayInput.position)) {
      return { error: "Workout day position must be a positive integer." };
    }

    if (dayPositions.has(dayInput.position)) {
      return { error: "Workout day positions must be unique within a plan." };
    }

    if (!Array.isArray(dayInput.exercises)) {
      return { error: "Workout day exercises must be an array." };
    }

    const exercisePositions = new Set<number>();
    const dayExercises: PlanExerciseInput[] = [];

    for (const exercise of dayInput.exercises) {
      const parsedExercise = parseExercise(exercise);

      if ("error" in parsedExercise) {
        return parsedExercise;
      }

      if (exercisePositions.has(parsedExercise.value.position)) {
        return { error: "Exercise positions must be unique within a workout day." };
      }

      exercisePositions.add(parsedExercise.value.position);
      dayExercises.push(parsedExercise.value);
    }

    dayPositions.add(dayInput.position);
    workoutDays.push({
      name: name.value,
      position: dayInput.position,
      exercises: dayExercises,
    });
  }

  return {
    value: {
      title: title.value,
      goal: goal.value,
      startDate: input.startDate,
      endDate: input.endDate,
      status: input.status as TrainingPlanStatus,
      clientUserId: input.clientUserId ?? null,
      workoutDays,
    },
  };
}

async function getLocalUser(clerkUserId: string): Promise<LocalUser | null> {
  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);

  return user ?? null;
}

async function isActiveTrainerAssignment(
  trainerUserId: string,
  clientUserId: string,
): Promise<boolean> {
  const [assignment] = await db
    .select({ id: trainerAssignments.id })
    .from(trainerAssignments)
    .where(
      and(
        eq(trainerAssignments.trainerUserId, trainerUserId),
        eq(trainerAssignments.clientUserId, clientUserId),
        eq(trainerAssignments.active, true),
      ),
    )
    .limit(1);

  return Boolean(assignment);
}

async function canAccessPlan(
  actor: LocalUser,
  plan: Pick<typeof trainingPlans.$inferSelect, "clientUserId" | "createdByUserId">,
  action: "read" | "update" | "delete",
): Promise<boolean> {
  if (actor.role === "ADMIN") {
    return true;
  }

  if (actor.role === "USER") {
    if (plan.clientUserId !== actor.id) {
      return false;
    }

    return action === "read" || plan.createdByUserId === actor.id;
  }

  if (!(await isActiveTrainerAssignment(actor.id, plan.clientUserId))) {
    return false;
  }

  return action !== "delete" || plan.createdByUserId === actor.id;
}

async function findPlanForAccess(id: string) {
  const [plan] = await db
    .select(planFields)
    .from(trainingPlans)
    .where(eq(trainingPlans.id, id))
    .limit(1);

  return plan ?? null;
}

async function resolveExercises(input: TrainingPlanInput) {
  const library = await db.select({ id: exercises.id, name: exercises.name }).from(exercises);
  const exerciseIds = new Map<string, string>();

  for (const exercise of library) {
    exerciseIds.set(normalizeExerciseName(exercise.name), exercise.id);
  }

  const newExercises: Array<{ id: string; name: string; description: string | null }> = [];

  for (const day of input.workoutDays) {
    for (const exercise of day.exercises) {
      const normalizedName = normalizeExerciseName(exercise.name);

      if (!exerciseIds.has(normalizedName)) {
        const id = randomUUID();
        exerciseIds.set(normalizedName, id);
        newExercises.push({
          id,
          name: exercise.name,
          description: exercise.description,
        });
      }
    }
  }

  return { exerciseIds, newExercises };
}

function createWorkoutRecords(
  planId: string,
  input: TrainingPlanInput,
  exerciseIds: Map<string, string>,
) {
  const days: Array<{ id: string; trainingPlanId: string; name: string; position: number }> = [];
  const planExercises: Array<{
    id: string;
    workoutDayId: string;
    exerciseId: string;
    sets: number;
    repetitions: number;
    weightKg: string | null;
    restSeconds: number | null;
    notes: string | null;
    position: number;
  }> = [];

  for (const day of input.workoutDays) {
    const workoutDayId = randomUUID();
    days.push({ id: workoutDayId, trainingPlanId: planId, name: day.name, position: day.position });

    for (const exercise of day.exercises) {
      const exerciseId = exerciseIds.get(normalizeExerciseName(exercise.name));

      if (!exerciseId) {
        throw new Error("Exercise resolution failed");
      }

      planExercises.push({
        id: randomUUID(),
        workoutDayId,
        exerciseId,
        sets: exercise.sets,
        repetitions: exercise.repetitions,
        weightKg: exercise.weightKg === null ? null : exercise.weightKg.toFixed(2),
        restSeconds: exercise.restSeconds,
        notes: exercise.notes,
        position: exercise.position,
      });
    }
  }

  return { days, planExercises };
}

async function getCompletePlan(plan: typeof trainingPlans.$inferSelect) {
  const days = await db
    .select({ id: workoutDays.id, name: workoutDays.name, position: workoutDays.position })
    .from(workoutDays)
    .where(eq(workoutDays.trainingPlanId, plan.id))
    .orderBy(asc(workoutDays.position));

  const dayIds = days.map((day) => day.id);
  const exerciseRows = dayIds.length === 0
    ? []
    : await db
        .select({
          workoutExerciseId: workoutExercises.id,
          workoutDayId: workoutExercises.workoutDayId,
          exerciseId: exercises.id,
          name: exercises.name,
          description: exercises.description,
          sets: workoutExercises.sets,
          repetitions: workoutExercises.repetitions,
          weightKg: workoutExercises.weightKg,
          restSeconds: workoutExercises.restSeconds,
          notes: workoutExercises.notes,
          position: workoutExercises.position,
        })
        .from(workoutExercises)
        .innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
        .where(inArray(workoutExercises.workoutDayId, dayIds))
        .orderBy(asc(workoutExercises.position));

  const exercisesByDay = new Map<string, typeof exerciseRows>();

  for (const exercise of exerciseRows) {
    const existing = exercisesByDay.get(exercise.workoutDayId) ?? [];
    existing.push(exercise);
    exercisesByDay.set(exercise.workoutDayId, existing);
  }

  return {
    ...plan,
    workoutDays: days.map((day) => ({
      ...day,
      exercises: exercisesByDay.get(day.id) ?? [],
    })),
  };
}

async function resolveCreateClientUserId(
  actor: LocalUser,
  inputClientUserId: string | null,
): Promise<{ value: string } | { error: string; status: 400 | 403 | 404 }> {
  if (actor.role === "USER") {
    if (inputClientUserId && inputClientUserId !== actor.id) {
      return { error: "Users may only create plans for themselves.", status: 403 };
    }

    return { value: actor.id };
  }

  if (!inputClientUserId) {
    return { error: "Client user ID is required.", status: 400 };
  }

  if (actor.role === "TRAINER" && !(await isActiveTrainerAssignment(actor.id, inputClientUserId))) {
    return { error: "Forbidden", status: 403 };
  }

  const [client] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, inputClientUserId))
    .limit(1);

  if (!client) {
    return { error: "Client was not found.", status: 404 };
  }

  return { value: inputClientUserId };
}

trainingPlansRouter.get("/training-plans", requireAuthenticatedUser, async (request, response) => {
  try {
    const actor = await getLocalUser(getAuthenticatedClerkUserId(request));

    if (!actor) {
      response.status(403).json({ error: "Forbidden" });
      return;
    }

    let plans;

    if (actor.role === "ADMIN") {
      plans = await db.select(planFields).from(trainingPlans).orderBy(asc(trainingPlans.startDate));
    } else if (actor.role === "USER") {
      plans = await db
        .select(planFields)
        .from(trainingPlans)
        .where(eq(trainingPlans.clientUserId, actor.id))
        .orderBy(asc(trainingPlans.startDate));
    } else {
      plans = await db
        .select(planFields)
        .from(trainingPlans)
        .innerJoin(
          trainerAssignments,
          eq(trainerAssignments.clientUserId, trainingPlans.clientUserId),
        )
        .where(
          and(
            eq(trainerAssignments.trainerUserId, actor.id),
            eq(trainerAssignments.active, true),
          ),
        )
        .orderBy(asc(trainingPlans.startDate));
    }

    response.status(200).json({ plans });
  } catch {
    console.error("Failed to list training plans");
    response.status(500).json({ error: "Internal server error" });
  }
});

trainingPlansRouter.get("/training-plans/:id", requireAuthenticatedUser, async (request, response) => {
  if (!isUuid(request.params.id)) {
    response.status(404).json({ error: "Training plan was not found." });
    return;
  }

  try {
    const actor = await getLocalUser(getAuthenticatedClerkUserId(request));
    const plan = await findPlanForAccess(request.params.id);

    if (!plan) {
      response.status(404).json({ error: "Training plan was not found." });
      return;
    }

    if (!actor || !(await canAccessPlan(actor, plan, "read"))) {
      response.status(403).json({ error: "Forbidden" });
      return;
    }

    response.status(200).json(await getCompletePlan(plan));
  } catch {
    console.error("Failed to load training plan");
    response.status(500).json({ error: "Internal server error" });
  }
});

trainingPlansRouter.post("/training-plans", requireAuthenticatedUser, async (request, response) => {
  const parsedInput = parseTrainingPlanInput(request.body);

  if ("error" in parsedInput) {
    response.status(400).json({ error: parsedInput.error });
    return;
  }

  try {
    const actor = await getLocalUser(getAuthenticatedClerkUserId(request));

    if (!actor) {
      response.status(403).json({ error: "Forbidden" });
      return;
    }

    const clientUserId = await resolveCreateClientUserId(actor, parsedInput.value.clientUserId);

    if ("error" in clientUserId) {
      response.status(clientUserId.status).json({ error: clientUserId.error });
      return;
    }

    const planId = randomUUID();
    const { exerciseIds, newExercises } = await resolveExercises(parsedInput.value);
    const { days, planExercises } = createWorkoutRecords(planId, parsedInput.value, exerciseIds);
    const now = new Date();

    await db.batch([
      db.insert(trainingPlans).values({
        id: planId,
        title: parsedInput.value.title,
        goal: parsedInput.value.goal,
        clientUserId: clientUserId.value,
        createdByUserId: actor.id,
        startDate: parsedInput.value.startDate,
        endDate: parsedInput.value.endDate,
        status: parsedInput.value.status,
        createdAt: now,
        updatedAt: now,
      }),
      ...(newExercises.length > 0 ? [db.insert(exercises).values(newExercises)] : []),
      ...(days.length > 0 ? [db.insert(workoutDays).values(days)] : []),
      ...(planExercises.length > 0 ? [db.insert(workoutExercises).values(planExercises)] : []),
    ]);

    const plan = await findPlanForAccess(planId);

    if (!plan) {
      throw new Error("Created training plan was not available");
    }

    response.status(201).json(await getCompletePlan(plan));
  } catch {
    console.error("Failed to create training plan");
    response.status(500).json({ error: "Internal server error" });
  }
});

trainingPlansRouter.put("/training-plans/:id", requireAuthenticatedUser, async (request, response) => {
  if (!isUuid(request.params.id)) {
    response.status(404).json({ error: "Training plan was not found." });
    return;
  }

  const parsedInput = parseTrainingPlanInput(request.body);

  if ("error" in parsedInput) {
    response.status(400).json({ error: parsedInput.error });
    return;
  }

  try {
    const actor = await getLocalUser(getAuthenticatedClerkUserId(request));
    const existingPlan = await findPlanForAccess(request.params.id);

    if (!existingPlan) {
      response.status(404).json({ error: "Training plan was not found." });
      return;
    }

    if (!actor || !(await canAccessPlan(actor, existingPlan, "update"))) {
      response.status(403).json({ error: "Forbidden" });
      return;
    }

    let clientUserId = existingPlan.clientUserId;

    if (actor.role === "ADMIN" && parsedInput.value.clientUserId) {
      const [client] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, parsedInput.value.clientUserId))
        .limit(1);

      if (!client) {
        response.status(404).json({ error: "Client was not found." });
        return;
      }

      clientUserId = parsedInput.value.clientUserId;
    } else if (parsedInput.value.clientUserId && parsedInput.value.clientUserId !== existingPlan.clientUserId) {
      response.status(403).json({ error: "Client ownership cannot be changed." });
      return;
    }

    const { exerciseIds, newExercises } = await resolveExercises(parsedInput.value);
    const { days, planExercises } = createWorkoutRecords(existingPlan.id, parsedInput.value, exerciseIds);
    const now = new Date();

    await db.batch([
      db
        .update(trainingPlans)
        .set({
          title: parsedInput.value.title,
          goal: parsedInput.value.goal,
          clientUserId,
          startDate: parsedInput.value.startDate,
          endDate: parsedInput.value.endDate,
          status: parsedInput.value.status,
          updatedAt: now,
        })
        .where(eq(trainingPlans.id, existingPlan.id)),
      db.delete(workoutDays).where(eq(workoutDays.trainingPlanId, existingPlan.id)),
      ...(newExercises.length > 0 ? [db.insert(exercises).values(newExercises)] : []),
      ...(days.length > 0 ? [db.insert(workoutDays).values(days)] : []),
      ...(planExercises.length > 0 ? [db.insert(workoutExercises).values(planExercises)] : []),
    ]);

    const plan = await findPlanForAccess(existingPlan.id);

    if (!plan) {
      throw new Error("Updated training plan was not available");
    }

    response.status(200).json(await getCompletePlan(plan));
  } catch {
    console.error("Failed to update training plan");
    response.status(500).json({ error: "Internal server error" });
  }
});

trainingPlansRouter.delete("/training-plans/:id", requireAuthenticatedUser, async (request, response) => {
  if (!isUuid(request.params.id)) {
    response.status(404).json({ error: "Training plan was not found." });
    return;
  }

  try {
    const actor = await getLocalUser(getAuthenticatedClerkUserId(request));
    const plan = await findPlanForAccess(request.params.id);

    if (!plan) {
      response.status(404).json({ error: "Training plan was not found." });
      return;
    }

    if (!actor || !(await canAccessPlan(actor, plan, "delete"))) {
      response.status(403).json({ error: "Forbidden" });
      return;
    }

    if (actor.role === "USER" && plan.status !== "DRAFT") {
      response.status(409).json({ error: "Only draft plans may be deleted by users." });
      return;
    }

    await db.delete(trainingPlans).where(eq(trainingPlans.id, plan.id));
    response.status(204).send();
  } catch {
    console.error("Failed to delete training plan");
    response.status(500).json({ error: "Internal server error" });
  }
});

export { trainingPlansRouter };
