import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import type {
  ProgressEntriesResponse,
  TrainingPlansResponse,
  WorkoutCompletionsResponse,
} from "../api/client";
import { ProgressCharts } from "./ProgressCharts";

type TrainerClientProgressPageProps = {
  getPlans: (signal?: AbortSignal) => Promise<TrainingPlansResponse>;
  getProgress: (clientId: string, signal?: AbortSignal) => Promise<ProgressEntriesResponse>;
  getCompletions: (
    clientId: string,
    signal?: AbortSignal,
    planId?: string,
  ) => Promise<WorkoutCompletionsResponse>;
};

export function TrainerClientProgressPage({
  getPlans,
  getProgress,
  getCompletions,
}: TrainerClientProgressPageProps) {
  const { clientId } = useParams();
  const [plans, setPlans] = useState<TrainingPlansResponse["plans"]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");

  useEffect(() => {
    if (!clientId) return;
    const controller = new AbortController();
    void getPlans(controller.signal).then((response) => {
      if (!controller.signal.aborted) {
        setPlans(response.plans.filter((plan) => plan.clientUserId === clientId));
      }
    }).catch(() => undefined);
    return () => controller.abort();
  }, [clientId, getPlans]);

  if (!clientId) return null;

  return (
    <section className="py-8 sm:py-10">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">Trainer workspace</p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight">Client progress</h2>
      <p className="mt-3 max-w-2xl text-slate-300">Review weight trends and completed workout days for the selected client and plan.</p>
      <label className="mt-8 block max-w-md text-sm font-medium">
        Completion chart plan
        <select className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" value={selectedPlanId} onChange={(event) => setSelectedPlanId(event.target.value)}>
          <option value="">All client plans</option>
          {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.title}</option>)}
        </select>
      </label>
      <ProgressCharts
        getProgress={(signal) => getProgress(clientId, signal)}
        getCompletions={(signal) => getCompletions(clientId, signal, selectedPlanId || undefined)}
      />
    </section>
  );
}
