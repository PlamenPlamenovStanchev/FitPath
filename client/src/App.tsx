import { SignIn, SignUp, UserButton, useAuth } from "@clerk/react";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";

import {
  ApiRequestError,
  createAuthenticatedApiClient,
  type FitPathUser,
} from "./api/client";
import { AuthenticatedDashboard } from "./components/AuthenticatedDashboard";
import { BmiCard } from "./components/BmiCard";
import { OnboardingWizard } from "./components/OnboardingWizard";

function PublicHome() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <section className="max-w-xl text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">
          Your route to better habits
        </p>
        <h1 className="text-5xl font-bold tracking-tight">FitPath</h1>
        <p className="mt-5 text-lg leading-8 text-slate-300">
          Build sustainable fitness habits with a plan that fits you.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            className="rounded-md bg-emerald-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
            to="/sign-up"
          >
            Create an account
          </Link>
          <Link
            className="rounded-md border border-slate-500 px-4 py-2 font-semibold text-slate-100 transition hover:border-slate-300 hover:bg-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
            to="/sign-in"
          >
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}

function LoadingState() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <p aria-live="polite">Loading FitPath…</p>
    </main>
  );
}

function ProtectedHome() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const apiClient = useMemo(
    () => createAuthenticatedApiClient(getToken),
    [getToken],
  );
  const [user, setUser] = useState<FitPathUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }

    let isCurrent = true;
    const controller = new AbortController();

    void apiClient
      .getMe(controller.signal)
      .then((response) => {
        if (isCurrent) {
          setUser(response);
        }
      })
      .catch((requestError: unknown) => {
        if (!isCurrent) {
          return;
        }

        if (requestError instanceof ApiRequestError) {
          setError(requestError.message);
          return;
        }

        setError("We could not load your FitPath account. Please try again.");
      });

    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [apiClient, isLoaded, isSignedIn]);

  if (!isLoaded) {
    return <LoadingState />;
  }

  if (!isSignedIn) {
    return <Navigate replace to="/sign-in" />;
  }

  if (!error && !user) {
    return <LoadingState />;
  }

  if (user && !user.onboardingCompleted && user.role === "USER") {
    return (
      <OnboardingWizard
        completeOnboarding={apiClient.completeOnboarding}
        onCompleted={(onboardingResponse) =>
          setUser((current) =>
            current
              ? {
                  ...current,
                  ...onboardingResponse.user,
                  profile: onboardingResponse.profile,
                }
              : current,
          )
        }
      />
    );
  }

  if (!error) {
    return <AuthenticatedDashboard user={user!} />;
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">
              Your route to better habits
            </p>
            <h1 className="mt-2 text-3xl font-bold">FitPath</h1>
          </div>
          <UserButton />
        </header>

        <section className="mt-10 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold">Authenticated</h2>
          {error ? (
            <p className="mt-3 text-rose-300" role="alert">
              {error}
            </p>
          ) : user ? (
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-slate-400">FitPath role</dt>
                <dd className="mt-1 font-medium">{user.role}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-400">Onboarding completed</dt>
                <dd className="mt-1 font-medium">
                  {user.onboardingCompleted ? "Yes" : "No"}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-slate-300" aria-live="polite">
              Loading your FitPath account…
            </p>
          )}
        </section>
        {user && !error && (
          <BmiCard
            initialHeightCm={user.profile?.heightCm ?? null}
            initialWeightKg={user.profile?.currentWeightKg ?? null}
          />
        )}
      </div>
    </main>
  );
}

function App() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <LoadingState />;
  }

  return (
    <Routes>
      <Route
        path="/*"
        element={isSignedIn ? <ProtectedHome /> : <PublicHome />}
      />
      <Route
        path="/sign-in/*"
        element={
          isSignedIn ? (
            <Navigate replace to="/" />
          ) : (
            <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-8">
              <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" />
            </main>
          )
        }
      />
      <Route
        path="/sign-up/*"
        element={
          isSignedIn ? (
            <Navigate replace to="/" />
          ) : (
            <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-8">
              <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" />
            </main>
          )
        }
      />
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  );
}

export default App;
