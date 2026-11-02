import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { ApiRequestError, type TrainerClientsResponse } from "../api/client";

export function TrainerClientsPage({
  getClients,
}: {
  getClients: (signal?: AbortSignal) => Promise<TrainerClientsResponse>;
}) {
  const [clients, setClients] = useState<TrainerClientsResponse["clients"]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void getClients(controller.signal)
      .then((response) => setClients(response.clients))
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            requestError instanceof ApiRequestError
              ? requestError.message
              : "We could not load your clients.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [getClients]);

  return (
    <section className="py-8 sm:py-10">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
        Trainer workspace
      </p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight">My Clients</h2>
      <p className="mt-3 max-w-2xl text-slate-300">
        These users are currently assigned to you.
      </p>

      {error ? (
        <p className="mt-6 text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : isLoading ? (
        <p className="mt-8 text-slate-300" aria-live="polite">
          Loading your clients…
        </p>
      ) : clients.length === 0 ? (
        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
          You do not have any active clients yet.
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {clients.map((client) => (
            <li
              className="rounded-xl border border-slate-800 bg-slate-900 p-5 transition hover:border-emerald-400/40"
              key={client.userId}
            >
              <div className="flex items-center gap-4">
                <span
                  className="flex size-12 items-center justify-center rounded-full bg-emerald-400/15 text-sm font-bold text-emerald-300"
                  aria-hidden="true"
                >
                  {client.clientLabel.replace("Client ", "C")}
                </span>
                <div>
                  <h3 className="font-semibold text-slate-100">
                    {client.clientLabel}
                  </h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Active coaching assignment
                  </p>
                </div>
                <span className="ml-auto rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                  Active
                </span>
              </div>
              <Link
                className="mt-5 inline-flex rounded-md border border-emerald-400 px-3 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-400/10"
                to={`/clients/${client.userId}/progress`}
              >
                View progress
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
