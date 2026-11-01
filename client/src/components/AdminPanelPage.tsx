import { useEffect, useState } from "react";
import { NavLink, Route, Routes, useParams } from "react-router-dom";

import {
  ApiRequestError,
  type AdminOverview,
  type AdminTrainingPlansResponse,
  type AdminUsersResponse,
  type TrainingPlan,
} from "../api/client";
import { AdminTrainerApplicationsPage } from "./AdminTrainerApplicationsPage";

type AdminPanelPageProps = {
  getOverview: (signal?: AbortSignal) => Promise<AdminOverview>;
  getUsers: (signal?: AbortSignal) => Promise<AdminUsersResponse>;
  getPlans: (signal?: AbortSignal) => Promise<AdminTrainingPlansResponse>;
  getPlan: (planId: string, signal?: AbortSignal) => Promise<TrainingPlan>;
  getApplications: React.ComponentProps<typeof AdminTrainerApplicationsPage>["getApplications"];
  approveApplication: React.ComponentProps<typeof AdminTrainerApplicationsPage>["approveApplication"];
  rejectApplication: React.ComponentProps<typeof AdminTrainerApplicationsPage>["rejectApplication"];
  downloadCertificate: React.ComponentProps<typeof AdminTrainerApplicationsPage>["downloadCertificate"];
};

const adminNavigationItems: Array<[to: string, label: string, end: boolean]> = [
  ["/admin", "Overview", true],
  ["/admin/applications", "Trainer Applications", false],
  ["/admin/users", "Users", false],
  ["/admin/plans", "Training Plans", false],
];

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiRequestError ? error.message : fallback;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

export function AdminPanelPage({
  getOverview,
  getUsers,
  getPlans,
  getPlan,
  getApplications,
  approveApplication,
  rejectApplication,
  downloadCertificate,
}: AdminPanelPageProps) {
  return (
    <section className="py-8 sm:py-10">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
        Administration
      </p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight">Admin Panel</h2>
      <p className="mt-3 max-w-2xl text-slate-300">
        Review existing FitPath records and trainer applications.
      </p>

      <nav className="mt-6 overflow-x-auto" aria-label="Admin navigation">
        <ul className="flex min-w-max gap-2">
          {adminNavigationItems.map(([to, label, end]) => (
            <li key={to}>
              <NavLink
                className={({ isActive }) =>
                  `block rounded-md px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-emerald-400 text-slate-950"
                      : "border border-slate-700 text-slate-200 hover:bg-slate-800"
                  }`
                }
                end={end === true}
                to={to}
              >
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <Routes>
        <Route index element={<AdminOverviewPage getOverview={getOverview} />} />
        <Route
          path="applications"
          element={
            <AdminTrainerApplicationsPage
              approveApplication={approveApplication}
              downloadCertificate={downloadCertificate}
              getApplications={getApplications}
              rejectApplication={rejectApplication}
            />
          }
        />
        <Route path="users" element={<AdminUsersPage getUsers={getUsers} />} />
        <Route path="plans" element={<AdminPlansPage getPlans={getPlans} />} />
        <Route path="plans/:planId" element={<AdminPlanPage getPlan={getPlan} />} />
      </Routes>
    </section>
  );
}

function AdminOverviewPage({
  getOverview,
}: {
  getOverview: AdminPanelPageProps["getOverview"];
}) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void getOverview(controller.signal)
      .then(setOverview)
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setError(errorMessage(requestError, "We could not load the admin overview."));
        }
      });
    return () => controller.abort();
  }, [getOverview]);

  if (error) return <p className="mt-8 text-rose-300" role="alert">{error}</p>;
  if (!overview) return <p className="mt-8 text-slate-300" aria-live="polite">Loading overview…</p>;

  const cards = [
    ["Total users", overview.totalUsers],
    ["Total trainers", overview.totalTrainers],
    ["Pending trainer applications", overview.pendingTrainerApplications],
    ["Total training plans", overview.totalTrainingPlans],
  ] as const;

  return <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label, value]) => <div className="rounded-xl border border-slate-800 bg-slate-900 p-5" key={label}><dt className="text-sm text-slate-400">{label}</dt><dd className="mt-2 text-2xl font-semibold">{value}</dd></div>)}</dl>;
}

function AdminUsersPage({ getUsers }: { getUsers: AdminPanelPageProps["getUsers"] }) {
  const [result, setResult] = useState<AdminUsersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void getUsers(controller.signal).then(setResult).catch((requestError: unknown) => {
      if (!controller.signal.aborted) setError(errorMessage(requestError, "We could not load users."));
    });
    return () => controller.abort();
  }, [getUsers]);

  if (error) return <p className="mt-8 text-rose-300" role="alert">{error}</p>;
  if (!result) return <p className="mt-8 text-slate-300" aria-live="polite">Loading users…</p>;
  if (result.users.length === 0) return <p className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-300">There are no FitPath users yet.</p>;

  return <div className="mt-8 overflow-x-auto rounded-xl border border-slate-800"><table className="min-w-full divide-y divide-slate-800 text-left text-sm"><thead className="bg-slate-900 text-slate-300"><tr><th className="px-4 py-3 font-medium">FitPath user ID</th><th className="px-4 py-3 font-medium">Role</th><th className="px-4 py-3 font-medium">Onboarding</th><th className="px-4 py-3 font-medium">Created</th></tr></thead><tbody className="divide-y divide-slate-800 bg-slate-950">{result.users.map((user) => <tr key={user.id}><td className="px-4 py-3 font-mono text-xs text-slate-300">{user.id}</td><td className="px-4 py-3">{user.role}</td><td className="px-4 py-3">{user.onboardingCompleted ? "Completed" : "Incomplete"}</td><td className="px-4 py-3 text-slate-300">{formatDate(user.createdAt)}</td></tr>)}</tbody></table></div>;
}

function AdminPlansPage({ getPlans }: { getPlans: AdminPanelPageProps["getPlans"] }) {
  const [result, setResult] = useState<AdminTrainingPlansResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void getPlans(controller.signal).then(setResult).catch((requestError: unknown) => {
      if (!controller.signal.aborted) setError(errorMessage(requestError, "We could not load training plans."));
    });
    return () => controller.abort();
  }, [getPlans]);

  if (error) return <p className="mt-8 text-rose-300" role="alert">{error}</p>;
  if (!result) return <p className="mt-8 text-slate-300" aria-live="polite">Loading training plans…</p>;
  if (result.plans.length === 0) return <p className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-300">There are no training plans yet.</p>;

  return <div className="mt-8 grid gap-4">{result.plans.map((plan) => <NavLink className="rounded-xl border border-slate-800 bg-slate-900 p-5 transition hover:border-emerald-400" key={plan.id} to={`/admin/plans/${plan.id}`}><h3 className="font-semibold">{plan.title}</h3><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3"><div><dt className="text-slate-400">Client user ID</dt><dd className="mt-1 break-all font-mono text-xs">{plan.clientUserId}</dd></div><div><dt className="text-slate-400">Creator user ID</dt><dd className="mt-1 break-all font-mono text-xs">{plan.createdByUserId}</dd></div><div><dt className="text-slate-400">Status</dt><dd className="mt-1">{plan.status}</dd></div><div><dt className="text-slate-400">Start date</dt><dd className="mt-1">{plan.startDate}</dd></div><div><dt className="text-slate-400">End date</dt><dd className="mt-1">{plan.endDate}</dd></div></dl></NavLink>)}</div>;
}

function AdminPlanPage({ getPlan }: { getPlan: AdminPanelPageProps["getPlan"] }) {
  const { planId } = useParams();
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!planId) return;
    const controller = new AbortController();
    void getPlan(planId, controller.signal).then(setPlan).catch((requestError: unknown) => {
      if (!controller.signal.aborted) setError(errorMessage(requestError, "We could not load this training plan."));
    });
    return () => controller.abort();
  }, [getPlan, planId]);

  if (error) return <p className="mt-8 text-rose-300" role="alert">{error}</p>;
  if (!plan) return <p className="mt-8 text-slate-300" aria-live="polite">Loading training plan…</p>;

  return <article className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6"><p className="text-sm text-emerald-400">{plan.status}</p><h3 className="mt-2 text-2xl font-semibold">{plan.title}</h3><p className="mt-3 text-slate-300">{plan.goal}</p><p className="mt-4 text-sm text-slate-400">{plan.startDate} to {plan.endDate}</p><div className="mt-6 grid gap-4">{plan.workoutDays.map((day) => <section className="rounded-lg border border-slate-700 bg-slate-950 p-4" key={day.id}><h4 className="font-semibold">{day.name}</h4>{day.exercises.length === 0 ? <p className="mt-2 text-sm text-slate-400">No exercises.</p> : <ul className="mt-3 grid gap-2 text-sm text-slate-300">{day.exercises.map((exercise) => <li key={exercise.workoutExerciseId}>{exercise.name} — {exercise.sets} sets × {exercise.repetitions} reps</li>)}</ul>}</section>)}</div></article>;
}
