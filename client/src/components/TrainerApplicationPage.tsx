import { useEffect, useState } from "react";

import {
  ApiRequestError,
  type TrainerApplication,
  type TrainerApplicationResponse,
} from "../api/client";

const maximumFileSizeBytes = 5 * 1024 * 1024;

type TrainerApplicationPageProps = {
  getMyTrainerApplication: (signal?: AbortSignal) => Promise<TrainerApplicationResponse>;
  createTrainerApplication: (payload: {
    specialization: string;
    biography: string;
    certificate: File;
  }) => Promise<TrainerApplicationResponse>;
};

const statusDetails = {
  PENDING: {
    label: "Pending",
    description: "Your trainer application is awaiting review.",
    className: "border-amber-400/40 bg-amber-400/10 text-amber-100",
  },
  APPROVED: {
    label: "Approved",
    description: "Your trainer application has been approved.",
    className: "border-emerald-400/40 bg-emerald-400/10 text-emerald-100",
  },
  REJECTED: {
    label: "Rejected",
    description: "Your trainer application was not approved. You may submit a new application.",
    className: "border-rose-400/40 bg-rose-400/10 text-rose-100",
  },
} as const;

function validateCertificate(certificate: File | null): string | null {
  if (!certificate) {
    return "A professional certificate PDF is required.";
  }

  if (certificate.type !== "application/pdf") {
    return "Certificate must be a PDF file.";
  }

  if (certificate.size === 0 || certificate.size > maximumFileSizeBytes) {
    return "Certificate must be larger than 0 bytes and no more than 5 MB.";
  }

  return null;
}

export function TrainerApplicationPage({
  getMyTrainerApplication,
  createTrainerApplication,
}: TrainerApplicationPageProps) {
  const [application, setApplication] = useState<TrainerApplication | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [specialization, setSpecialization] = useState("");
  const [biography, setBiography] = useState("");
  const [certificate, setCertificate] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    void getMyTrainerApplication(controller.signal)
      .then((response) => setApplication(response.application))
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          requestError instanceof ApiRequestError
            ? requestError.message
            : "We could not load your trainer application.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [getMyTrainerApplication]);

  const hasPendingApplication = application?.status === "PENDING";
  const status = application ? statusDetails[application.status] : null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (hasPendingApplication || isSubmitting) {
      return;
    }

    const trimmedSpecialization = specialization.trim();
    const trimmedBiography = biography.trim();
    const certificateError = validateCertificate(certificate);

    if (!trimmedSpecialization) {
      setError("Specialization is required.");
      return;
    }

    if (!trimmedBiography) {
      setError("Biography is required.");
      return;
    }

    if (certificateError) {
      setError(certificateError);
      return;
    }

    if (!certificate) {
      setError("A professional certificate PDF is required.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await createTrainerApplication({
        specialization: trimmedSpecialization,
        biography: trimmedBiography,
        certificate,
      });

      setApplication(response.application);
      setCertificate(null);
    } catch (requestError) {
      setError(
        requestError instanceof ApiRequestError
          ? requestError.message
          : "We could not submit your trainer application.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="py-8 sm:py-10">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
        Trainer application
      </p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight">Become a Trainer</h2>
      <p className="mt-3 max-w-2xl text-slate-300">
        Tell us about your expertise and submit your professional certificate
        for review.
      </p>

      {isLoading ? (
        <p className="mt-8 text-slate-300" aria-live="polite">
          Loading your application status…
        </p>
      ) : (
        <>
          {status && (
            <section
              className={`mt-8 rounded-xl border p-5 ${status.className}`}
              aria-live="polite"
            >
              <h3 className="text-lg font-semibold">{status.label}</h3>
              <p className="mt-1 text-sm">{status.description}</p>
            </section>
          )}

          {error && (
            <p className="mt-6 text-sm text-rose-300" role="alert">
              {error}
            </p>
          )}

          <form
            className="mt-8 max-w-2xl rounded-xl border border-slate-800 bg-slate-900 p-6"
            onSubmit={(event) => void submit(event)}
          >
            <fieldset disabled={hasPendingApplication || isSubmitting}>
              <div>
                <label className="block text-sm font-medium" htmlFor="specialization">
                  Specialization
                </label>
                <input
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none disabled:cursor-not-allowed disabled:opacity-60 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30"
                  id="specialization"
                  value={specialization}
                  maxLength={120}
                  required
                  onChange={(event) => setSpecialization(event.target.value)}
                />
              </div>

              <div className="mt-5">
                <label className="block text-sm font-medium" htmlFor="biography">
                  Short biography
                </label>
                <textarea
                  className="mt-2 min-h-32 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none disabled:cursor-not-allowed disabled:opacity-60 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30"
                  id="biography"
                  value={biography}
                  maxLength={1000}
                  required
                  onChange={(event) => setBiography(event.target.value)}
                />
              </div>

              <div className="mt-5">
                <label className="block text-sm font-medium" htmlFor="certificate">
                  Professional certificate (PDF, maximum 5 MB)
                </label>
                <input
                  className="mt-2 block w-full text-sm text-slate-300 file:mr-4 file:rounded-md file:border-0 file:bg-emerald-400 file:px-3 file:py-2 file:font-semibold file:text-slate-950 hover:file:bg-emerald-300 disabled:cursor-not-allowed"
                  id="certificate"
                  type="file"
                  accept="application/pdf"
                  required
                  onChange={(event) => setCertificate(event.target.files?.[0] ?? null)}
                />
              </div>
            </fieldset>

            <button
              className="mt-6 rounded-md bg-emerald-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
              type="submit"
              disabled={hasPendingApplication || isSubmitting}
            >
              {hasPendingApplication
                ? "Application pending"
                : isSubmitting
                  ? "Submitting…"
                  : "Submit application"}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
