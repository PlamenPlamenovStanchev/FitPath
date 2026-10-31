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
  };
}
