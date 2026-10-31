export type FitPathUser = {
  id: string;
  role: "USER" | "TRAINER" | "ADMIN";
  onboardingCompleted: boolean;
  profile: FitPathProfile | null;
};

export type ActivityLevel =
  "SEDENTARY" | "LIGHTLY_ACTIVE" | "MODERATELY_ACTIVE" | "VERY_ACTIVE";

export type FitnessGoal =
  "LOSE_WEIGHT" | "BUILD_MUSCLE" | "IMPROVE_FITNESS" | "MAINTAIN_CONDITION";

export type FitPathProfile = {
  age: number | null;
  heightCm: number | null;
  currentWeightKg: number | null;
  activityLevel: ActivityLevel | null;
  fitnessGoal: FitnessGoal | null;
};

export type OnboardingPayload = {
  age: number;
  heightCm: number;
  currentWeightKg: number;
  activityLevel: ActivityLevel;
  fitnessGoal: FitnessGoal;
};

export type OnboardingResponse = {
  user: Pick<FitPathUser, "id" | "role" | "onboardingCompleted">;
  profile: {
    age: number;
    heightCm: number;
    currentWeightKg: number;
    activityLevel: ActivityLevel;
    fitnessGoal: FitnessGoal;
  };
};

export type TrainerApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";

export type TrainerApplication = {
  id: string;
  status: TrainerApplicationStatus;
  submittedAt: string;
};

export type TrainerApplicationResponse = {
  application: TrainerApplication | null;
};

export type AdminTrainerApplication = {
  id: string;
  applicantId: string;
  specialization: string;
  biography: string;
  submittedAt: string;
};

export type AdminTrainerApplicationsResponse = {
  applications: AdminTrainerApplication[];
};

export type Trainer = {
  userId: string;
  specialization: string;
  biography: string;
  profilePhotoAvailable: boolean;
  profilePhotoAccessPath: string | null;
};

export type TrainersResponse = {
  trainers: Trainer[];
};

export type MyTrainerResponse = {
  trainer: Trainer | null;
};

export type TrainerClientsResponse = {
  clients: Array<{ userId: string; clientId: string }>;
};

export type TrainingPlanStatus = "DRAFT" | "ACTIVE" | "COMPLETED";

export type TrainingPlanExercise = {
  workoutExerciseId: string;
  exerciseId: string;
  name: string;
  description: string | null;
  sets: number;
  repetitions: number;
  weightKg: string | null;
  restSeconds: number | null;
  notes: string | null;
  position: number;
};

export type TrainingPlan = {
  id: string;
  title: string;
  goal: string;
  clientUserId: string;
  createdByUserId: string;
  startDate: string;
  endDate: string;
  status: TrainingPlanStatus;
  workoutDays: Array<{
    id: string;
    name: string;
    position: number;
    exercises: TrainingPlanExercise[];
  }>;
};

export type TrainingPlanSummary = Omit<TrainingPlan, "workoutDays">;

export type TrainingPlanPayload = {
  title: string;
  goal: string;
  startDate: string;
  endDate: string;
  status: TrainingPlanStatus;
  clientUserId?: string;
  workoutDays: Array<{
    name: string;
    position: number;
    exercises: Array<{
      name: string;
      description?: string | null;
      sets: number;
      repetitions: number;
      weightKg?: number | null;
      restSeconds?: number | null;
      notes?: string | null;
      position: number;
    }>;
  }>;
};

export type TrainingPlansResponse = { plans: TrainingPlanSummary[] };

export type WorkoutCompletion = {
  id: string;
  workoutDayId: string;
  completedAt: string;
};

export type WorkoutCompletionsResponse = {
  completions: WorkoutCompletion[];
};

export type ProgressPhoto = {
  id: string;
  createdAt: string;
};

export type ProgressPhotosResponse = {
  photos: ProgressPhoto[];
};

export type ProgressEntry = {
  id: string;
  weightKg: number;
  bmi: number;
  recordedAt: string;
};

export type ProgressEntriesResponse = {
  entries: ProgressEntry[];
};

type GetToken = () => Promise<string | null>;

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export function createAuthenticatedApiClient(getToken: GetToken) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await getToken();

    if (!token) {
      throw new ApiRequestError("Your session is no longer available.", 401);
    }

    // The session may have changed while getToken() was pending.
    init.signal?.throwIfAborted();
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);

    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      const errorBody: unknown = await response.json().catch(() => null);
      const message =
        errorBody &&
        typeof errorBody === "object" &&
        "error" in errorBody &&
        typeof errorBody.error === "string"
          ? errorBody.error
          : response.status === 401
            ? "Your session has expired. Please sign in again."
            : "We could not complete this request. Please try again.";

      throw new ApiRequestError(
        message,
        response.status,
      );
    }

    return (await response.json()) as T;
  }

  async function requestBlob(path: string): Promise<Blob> {
    const token = await getToken();

    if (!token) {
      throw new ApiRequestError("Your session is no longer available.", 401);
    }

    const response = await fetch(`${apiBaseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const errorBody: unknown = await response.json().catch(() => null);
      const message =
        errorBody &&
        typeof errorBody === "object" &&
        "error" in errorBody &&
        typeof errorBody.error === "string"
          ? errorBody.error
          : "We could not retrieve this certificate. Please try again.";

      throw new ApiRequestError(message, response.status);
    }

    return response.blob();
  }

  return {
    getMe: (signal?: AbortSignal) =>
      request<FitPathUser>("/api/me", { signal }),
    completeOnboarding: (payload: OnboardingPayload) =>
      request<OnboardingResponse>("/api/me/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    getMyTrainerApplication: (signal?: AbortSignal) =>
      request<TrainerApplicationResponse>("/api/trainer-applications/me", {
        signal,
      }),
    createTrainerApplication: (payload: {
      specialization: string;
      biography: string;
      certificate: File;
    }) => {
      const formData = new FormData();
      formData.append("specialization", payload.specialization);
      formData.append("biography", payload.biography);
      formData.append("certificate", payload.certificate);

      return request<TrainerApplicationResponse>("/api/trainer-applications", {
        method: "POST",
        body: formData,
      });
    },
    getAdminTrainerApplications: (signal?: AbortSignal) =>
      request<AdminTrainerApplicationsResponse>("/api/admin/trainer-applications", {
        signal,
      }),
    approveTrainerApplication: (applicationId: string) =>
      request<{ status: "APPROVED" }>(
        `/api/admin/trainer-applications/${applicationId}/approve`,
        { method: "PATCH" },
      ),
    rejectTrainerApplication: (applicationId: string) =>
      request<{ status: "REJECTED" }>(
        `/api/admin/trainer-applications/${applicationId}/reject`,
        { method: "PATCH" },
      ),
    downloadTrainerCertificate: (applicationId: string) =>
      requestBlob(`/api/admin/trainer-applications/${applicationId}/certificate`),
    getTrainers: (signal?: AbortSignal) =>
      request<TrainersResponse>("/api/trainers", { signal }),
    getMyTrainer: (signal?: AbortSignal) =>
      request<MyTrainerResponse>("/api/me/trainer", { signal }),
    assignTrainer: (trainerUserId: string) =>
      request<{ trainerUserId: string }>("/api/me/trainer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainerUserId }),
      }),
    getTrainerProfilePhoto: (trainerUserId: string) =>
      requestBlob(`/api/trainers/${trainerUserId}/profile-photo`),
    getTrainerClients: (signal?: AbortSignal) =>
      request<TrainerClientsResponse>("/api/trainer/clients", { signal }),
    getTrainingPlans: (signal?: AbortSignal) =>
      request<TrainingPlansResponse>("/api/training-plans", { signal }),
    getTrainingPlan: (planId: string, signal?: AbortSignal) =>
      request<TrainingPlan>(`/api/training-plans/${planId}`, { signal }),
    createTrainingPlan: (payload: TrainingPlanPayload) =>
      request<TrainingPlan>("/api/training-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    updateTrainingPlan: (planId: string, payload: TrainingPlanPayload) =>
      request<TrainingPlan>(`/api/training-plans/${planId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    downloadTrainingPlanPdf: (planId: string) =>
      requestBlob(`/api/training-plans/${planId}/pdf`),
    getMyWorkoutCompletions: (signal?: AbortSignal) =>
      request<WorkoutCompletionsResponse>("/api/me/workout-completions", { signal }),
    completeWorkoutDay: (workoutDayId: string) =>
      request<{ completion: WorkoutCompletion }>(`/api/workout-days/${workoutDayId}/complete`, {
        method: "POST",
      }).then((response) => response.completion),
    undoWorkoutDayCompletion: (workoutDayId: string) =>
      request<{ workoutDayId: string }>(`/api/workout-days/${workoutDayId}/complete`, {
        method: "DELETE",
      }).then(() => undefined),
    getTrainerClientWorkoutCompletions: (clientUserId: string, signal?: AbortSignal) =>
      request<WorkoutCompletionsResponse>(
        `/api/trainer/clients/${clientUserId}/workout-completions`,
        { signal },
      ),
    getMyProgressPhotos: (signal?: AbortSignal) =>
      request<ProgressPhotosResponse>("/api/me/progress-photos", { signal }),
    getMyProgress: (signal?: AbortSignal) =>
      request<ProgressEntriesResponse>("/api/me/progress", { signal }),
    uploadProgressPhoto: (photo: File) => {
      const formData = new FormData();
      formData.append("photo", photo);
      return request<{ photo: ProgressPhoto }>("/api/me/progress-photos", {
        method: "POST",
        body: formData,
      }).then((response) => response.photo);
    },
    getMyProgressPhoto: (photoId: string) =>
      requestBlob(`/api/me/progress-photos/${photoId}`),
    deleteMyProgressPhoto: (photoId: string) =>
      request<{ id: string }>(`/api/me/progress-photos/${photoId}`, {
        method: "DELETE",
      }).then(() => undefined),
    getTrainerClientProgressPhotos: (clientUserId: string, signal?: AbortSignal) =>
      request<ProgressPhotosResponse>(`/api/trainer/clients/${clientUserId}/progress-photos`, { signal }),
    getTrainerClientProgressPhoto: (clientUserId: string, photoId: string) =>
      requestBlob(`/api/trainer/clients/${clientUserId}/progress-photos/${photoId}`),
  };
}
