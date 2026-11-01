import { useEffect, useState } from "react";

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
              className="rounded-xl border border-slate-800 bg-slate-900 p-5"
              key={client.userId}
            >
              <p className="text-sm text-slate-400">Client</p>
              <p className="mt-2 font-semibold">{client.clientId}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
