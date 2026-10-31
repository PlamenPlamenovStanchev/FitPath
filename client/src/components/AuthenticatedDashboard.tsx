import { UserButton } from "@clerk/react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";

import type {
  AdminTrainerApplicationsResponse,
  ActivityLevel,
  FitPathProfile,
  FitPathUser,
  FitnessGoal,
  TrainerApplicationResponse,
  TrainerClientsResponse,
  TrainingPlan,
  TrainingPlanPayload,
  TrainingPlansResponse,
  TrainersResponse,
  WorkoutCompletion,
  WorkoutCompletionsResponse,
  ProgressPhoto,
  ProgressPhotosResponse,
  ProgressEntriesResponse,
} from "../api/client";
import { calculateBmi } from "../utils/bmi";
import { AdminTrainerApplicationsPage } from "./AdminTrainerApplicationsPage";
import { BmiCard } from "./BmiCard";
import { MyCoachPage } from "./MyCoachPage";
import { ProgressPhotosPage } from "./ProgressPhotosPage";
import { TrainerClientsPage } from "./TrainerClientsPage";
import { TrainerApplicationPage } from "./TrainerApplicationPage";
import { TrainingPlanEditorPage } from "./TrainingPlanEditorPage";

type AuthenticatedDashboardProps = {
  user: FitPathUser;
  getMyTrainerApplication: (signal?: AbortSignal) => Promise<TrainerApplicationResponse>;
  createTrainerApplication: (payload: {
    specialization: string;
    biography: string;
    certificate: File;
  }) => Promise<TrainerApplicationResponse>;
  getAdminTrainerApplications: (signal?: AbortSignal) => Promise<AdminTrainerApplicationsResponse>;
  approveTrainerApplication: (applicationId: string) => Promise<unknown>;
  rejectTrainerApplication: (applicationId: string) => Promise<unknown>;
  downloadTrainerCertificate: (applicationId: string) => Promise<Blob>;
  getTrainers: (signal?: AbortSignal) => Promise<TrainersResponse>;
  getMyTrainer: (signal?: AbortSignal) => Promise<{ trainer: TrainersResponse["trainers"][number] | null }>;
  assignTrainer: (trainerUserId: string) => Promise<unknown>;
  getTrainerProfilePhoto: (trainerUserId: string) => Promise<Blob>;
  getTrainerClients: (signal?: AbortSignal) => Promise<TrainerClientsResponse>;
  getTrainingPlans: (signal?: AbortSignal) => Promise<TrainingPlansResponse>;
  getTrainingPlan: (planId: string, signal?: AbortSignal) => Promise<TrainingPlan>;
  createTrainingPlan: (payload: TrainingPlanPayload) => Promise<TrainingPlan>;
  updateTrainingPlan: (planId: string, payload: TrainingPlanPayload) => Promise<TrainingPlan>;
  downloadTrainingPlanPdf: (planId: string) => Promise<Blob>;
  getMyWorkoutCompletions: (signal?: AbortSignal) => Promise<WorkoutCompletionsResponse>;
  completeWorkoutDay: (workoutDayId: string) => Promise<WorkoutCompletion>;
  undoWorkoutDayCompletion: (workoutDayId: string) => Promise<void>;
  getMyProgressPhotos: (signal?: AbortSignal) => Promise<ProgressPhotosResponse>;
  uploadProgressPhoto: (photo: File) => Promise<ProgressPhoto>;
  getMyProgressPhoto: (photoId: string) => Promise<Blob>;
  deleteMyProgressPhoto: (photoId: string) => Promise<void>;
  getMyProgress: (signal?: AbortSignal) => Promise<ProgressEntriesResponse>;
};

const activityLevelLabels: Record<ActivityLevel, string> = {
  SEDENTARY: "Sedentary",
  LIGHTLY_ACTIVE: "Lightly active",
  MODERATELY_ACTIVE: "Moderately active",
  VERY_ACTIVE: "Very active",
};

const fitnessGoalLabels: Record<FitnessGoal, string> = {
  LOSE_WEIGHT: "Lose weight",
  BUILD_MUSCLE: "Build muscle",
  IMPROVE_FITNESS: "Improve fitness",
  MAINTAIN_CONDITION: "Maintain current condition",
};

const navigation = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/plans", label: "My Plans", end: false },
  { to: "/coach", label: "My Coach", end: false },
  { to: "/progress", label: "Progress", end: false },
  { to: "/profile", label: "Profile", end: false },
] as const;

function displayValue(value: number | null, unit: string): string {
  return value === null ? "Not available" : `${value} ${unit}`;
}

function getCurrentBmi(profile: FitPathProfile | null): string {
  if (
    !profile ||
    profile.heightCm === null ||
    profile.currentWeightKg === null
  ) {
    return "Not available";
  }

  try {
    return calculateBmi(profile.currentWeightKg, profile.heightCm).toFixed(1);
  } catch {
    return "Not available";
  }
}

function labelActivityLevel(value: ActivityLevel | null): string {
  return value === null ? "Not available" : activityLevelLabels[value];
}

function labelFitnessGoal(value: FitnessGoal | null): string {
  return value === null ? "Not available" : fitnessGoalLabels[value];
}

export function AuthenticatedDashboard({
  user,
  getMyTrainerApplication,
  createTrainerApplication,
  getAdminTrainerApplications,
  approveTrainerApplication,
  rejectTrainerApplication,
  downloadTrainerCertificate,
  getTrainers,
  getMyTrainer,
  assignTrainer,
  getTrainerProfilePhoto,
  getTrainerClients,
  getTrainingPlans,
  getTrainingPlan,
  createTrainingPlan,
  updateTrainingPlan,
  downloadTrainingPlanPdf,
  getMyWorkoutCompletions,
  completeWorkoutDay,
  undoWorkoutDayCompletion,
  getMyProgressPhotos,
  uploadProgressPhoto,
  getMyProgressPhoto,
  deleteMyProgressPhoto,
  getMyProgress,
}: AuthenticatedDashboardProps) {
  const roleNavigation = navigation.map((item) =>
    user.role === "TRAINER" && item.to === "/coach"
      ? { ...item, label: "My Clients" }
      : item,
  );
  const visibleNavigation =
    user.role === "USER"
      ? [...roleNavigation, { to: "/become-a-trainer", label: "Become a Trainer", end: false }]
      : user.role === "ADMIN"
        ? [...roleNavigation, { to: "/admin/trainer-applications", label: "Trainer applications", end: false }]
        : roleNavigation;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-slate-800 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <NavLink className="group" to="/" aria-label="FitPath dashboard">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">
                Your route to better habits
              </p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight group-hover:text-emerald-200">
                FitPath
              </h1>
            </NavLink>
            <UserButton />
          </div>
          <nav className="mt-5 overflow-x-auto" aria-label="Primary navigation">
            <ul className="flex min-w-max gap-1">
              {visibleNavigation.map((item) => (
                <li key={item.to}>
                  <NavLink
                    className={({ isActive }) =>
                      `block rounded-md px-3 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 ${
                        isActive
                          ? "bg-emerald-400 text-slate-950"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`
                    }
                    end={item.end}
                    to={item.to}
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </header>

        <Routes>
          <Route index element={<DashboardPage user={user} />} />
          <Route
            path="profile"
            element={<ProfilePage profile={user.profile} />}
          />
          <Route
            path="plans"
            element={
              user.role === "USER" || user.role === "TRAINER" ? (
                <TrainingPlanEditorPage
                  user={user}
                  getPlans={getTrainingPlans}
                  getPlan={getTrainingPlan}
                  createPlan={createTrainingPlan}
                  updatePlan={updateTrainingPlan}
                  getTrainerClients={getTrainerClients}
                  downloadPlanPdf={downloadTrainingPlanPdf}
                  getWorkoutCompletions={getMyWorkoutCompletions}
                  completeWorkoutDay={completeWorkoutDay}
                  undoWorkoutDayCompletion={undoWorkoutDayCompletion}
                />
              ) : (
                <PlaceholderPage
                  title="Training plans"
                  description="Plan editing is available to FitPath users and trainers."
                />
              )
            }
          />
          <Route
            path="coach"
            element={
              user.role === "USER" ? (
                <MyCoachPage
                  getTrainers={getTrainers}
                  getMyTrainer={getMyTrainer}
                  assignTrainer={assignTrainer}
                  getProfilePhoto={getTrainerProfilePhoto}
                />
              ) : user.role === "TRAINER" ? (
                <TrainerClientsPage getClients={getTrainerClients} />
              ) : (
                <PlaceholderPage
                  title="My Coach"
                  description="Coach connections are only available to FitPath users."
                />
              )
            }
          />
          <Route
            path="progress"
            element={
              user.role === "USER" ? (
                <ProgressPhotosPage
                  getPhotos={getMyProgressPhotos}
                  uploadPhoto={uploadProgressPhoto}
                  getPhoto={getMyProgressPhoto}
                  deletePhoto={deleteMyProgressPhoto}
                  getProgress={getMyProgress}
                  getCompletions={getMyWorkoutCompletions}
                />
              ) : (
                <PlaceholderPage
                  title="Progress"
                  description="Progress photos are available to FitPath users."
                />
              )
            }
          />
          <Route
            path="become-a-trainer"
            element={
              user.role === "USER" ? (
                <TrainerApplicationPage
                  getMyTrainerApplication={getMyTrainerApplication}
                  createTrainerApplication={createTrainerApplication}
                />
              ) : (
                <Navigate replace to="/" />
              )
            }
          />
          <Route
            path="admin/trainer-applications"
            element={
              user.role === "ADMIN" ? (
                <AdminTrainerApplicationsPage
                  getApplications={getAdminTrainerApplications}
                  approveApplication={approveTrainerApplication}
                  rejectApplication={rejectTrainerApplication}
                  downloadCertificate={downloadTrainerCertificate}
                />
              ) : (
                <Navigate replace to="/" />
              )
            }
          />
          <Route path="*" element={<Navigate replace to="/" />} />
        </Routes>
      </div>
    </main>
  );
}

function DashboardPage({ user }: { user: FitPathUser }) {
  const profile = user.profile;

  return (
    <section className="py-8 sm:py-10">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
          Dashboard
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight">
          Welcome to your FitPath dashboard
        </h2>
        <p className="mt-3 max-w-2xl text-slate-300">
          Your current fitness details are ready whenever you need a quick
          check-in.
        </p>
      </div>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Fitness goal"
          value={labelFitnessGoal(profile?.fitnessGoal ?? null)}
        />
        <SummaryCard
          label="Activity level"
          value={labelActivityLevel(profile?.activityLevel ?? null)}
        />
        <SummaryCard
          label="Current weight"
          value={displayValue(profile?.currentWeightKg ?? null, "kg")}
        />
        <SummaryCard label="Current BMI" value={getCurrentBmi(profile)} />
      </dl>

      <BmiCard
        initialHeightCm={profile?.heightCm ?? null}
        initialWeightKg={profile?.currentWeightKg ?? null}
      />
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <dt className="text-sm text-slate-400">{label}</dt>
      <dd className="mt-2 text-lg font-semibold text-slate-100">{value}</dd>
    </div>
  );
}

function ProfilePage({ profile }: { profile: FitPathProfile | null }) {
  const details = [
    [
      "Age",
      !profile || profile.age === null
        ? "Not available"
        : `${profile.age} years`,
    ],
    ["Height", displayValue(profile?.heightCm ?? null, "cm")],
    ["Weight", displayValue(profile?.currentWeightKg ?? null, "kg")],
    ["Activity level", labelActivityLevel(profile?.activityLevel ?? null)],
    ["Fitness goal", labelFitnessGoal(profile?.fitnessGoal ?? null)],
  ] as const;

  return (
    <section className="py-8 sm:py-10">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
        Profile
      </p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight">Your profile</h2>
      <p className="mt-3 max-w-2xl text-slate-300">
        These are the details you supplied during onboarding.
      </p>
      <dl className="mt-8 grid gap-4 sm:grid-cols-2">
        {details.map(([label, value]) => (
          <div
            className="rounded-xl border border-slate-800 bg-slate-900 p-5"
            key={label}
          >
            <dt className="text-sm text-slate-400">{label}</dt>
            <dd className="mt-2 text-lg font-semibold text-slate-100">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="py-8 sm:py-10">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
        Coming later
      </p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight">{title}</h2>
      <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
        {description}
      </div>
    </section>
  );
}
