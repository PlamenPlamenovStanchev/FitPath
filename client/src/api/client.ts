export type FitPathUser = {
  id: string;
  role: "USER" | "TRAINER" | "ADMIN";
  onboardingCompleted: boolean;
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

    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiRequestError(
        response.status === 401
          ? "Your session has expired. Please sign in again."
          : "We could not complete this request. Please try again.",
        response.status,
      );
    }

    return (await response.json()) as T;
  }

  return {
    getMe: () => request<FitPathUser>("/api/me"),
  };
}
