import { useEffect, useState } from "react";

import {
  ApiRequestError,
  type AdminTrainerApplication,
  type AdminTrainerApplicationsResponse,
} from "../api/client";

type AdminTrainerApplicationsPageProps = {
  getApplications: (signal?: AbortSignal) => Promise<AdminTrainerApplicationsResponse>;
  approveApplication: (applicationId: string) => Promise<unknown>;
  rejectApplication: (applicationId: string) => Promise<unknown>;
  downloadCertificate: (applicationId: string) => Promise<Blob>;
};

export function AdminTrainerApplicationsPage({
  getApplications,
  approveApplication,
  rejectApplication,
  downloadCertificate,
}: AdminTrainerApplicationsPageProps) {
  const [applications, setApplications] = useState<AdminTrainerApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeApplicationId, setActiveApplicationId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void getApplications(controller.signal)
      .then((response) => setApplications(response.applications))
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            requestError instanceof ApiRequestError
              ? requestError.message
              : "We could not load trainer applications.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [getApplications]);

  async function reviewApplication(
    applicationId: string,
    action: (id: string) => Promise<unknown>,
  ) {
    setError(null);
    setActiveApplicationId(applicationId);

    try {
      await action(applicationId);
      setApplications((current) =>
        current.filter((application) => application.id !== applicationId),
      );
    } catch (requestError) {
      setError(
        requestError instanceof ApiRequestError
          ? requestError.message
          : "We could not update this trainer application.",
      );
    } finally {
      setActiveApplicationId(null);
    }
  }

  async function download(applicationId: string) {
    setError(null);
    setActiveApplicationId(applicationId);

    try {
      const certificate = await downloadCertificate(applicationId);
      const url = URL.createObjectURL(certificate);
      const link = document.createElement("a");
      link.href = url;
      link.download = "trainer-certificate.pdf";
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(
        requestError instanceof ApiRequestError
          ? requestError.message
          : "We could not download this certificate.",
      );
    } finally {
      setActiveApplicationId(null);
    }
  }

  return (
    <section className="py-8 sm:py-10">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
        Administration
      </p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight">
        Trainer applications
      </h2>
      <p className="mt-3 max-w-2xl text-slate-300">
        Review pending trainer applications and their private certificates.
      </p>

      {error && (
        <p className="mt-6 text-sm text-rose-300" role="alert">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="mt-8 text-slate-300" aria-live="polite">
          Loading pending applications…
        </p>
      ) : applications.length === 0 ? (
        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
          There are no pending trainer applications.
        </div>
      ) : (
        <div className="mt-8 grid gap-5">
          {applications.map((application) => {
            const isActive = activeApplicationId === application.id;

            return (
              <article
                className="rounded-xl border border-slate-800 bg-slate-900 p-6"
                key={application.id}
              >
                <p className="text-sm text-slate-400">
                  Applicant: {application.applicantId}
                </p>
                <h3 className="mt-3 text-xl font-semibold">
                  {application.specialization}
                </h3>
                <p className="mt-3 whitespace-pre-wrap text-slate-300">
                  {application.biography}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    className="rounded-md border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    type="button"
                    disabled={isActive}
                    onClick={() => void download(application.id)}
                  >
                    Download certificate
                  </button>
                  <button
                    className="rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                    type="button"
                    disabled={isActive}
                    onClick={() => void reviewApplication(application.id, approveApplication)}
                  >
                    Approve
                  </button>
                  <button
                    className="rounded-md bg-rose-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
                    type="button"
                    disabled={isActive}
                    onClick={() => void reviewApplication(application.id, rejectApplication)}
                  >
                    Reject
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
