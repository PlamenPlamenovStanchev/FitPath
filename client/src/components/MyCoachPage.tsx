import { useEffect, useState } from "react";

import {
  ApiRequestError,
  type MyTrainerResponse,
  type Trainer,
  type TrainersResponse,
} from "../api/client";

type MyCoachPageProps = {
  getTrainers: (signal?: AbortSignal) => Promise<TrainersResponse>;
  getMyTrainer: (signal?: AbortSignal) => Promise<MyTrainerResponse>;
  assignTrainer: (trainerUserId: string) => Promise<unknown>;
  getProfilePhoto: (trainerUserId: string) => Promise<Blob>;
};

export function MyCoachPage({
  getTrainers,
  getMyTrainer,
  assignTrainer,
  getProfilePhoto,
}: MyCoachPageProps) {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [selectedTrainer, setSelectedTrainer] = useState<Trainer | null>(null);
  const [profilePhotos, setProfilePhotos] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const objectUrls: string[] = [];

    void Promise.all([getTrainers(controller.signal), getMyTrainer(controller.signal)])
      .then(async ([trainersResponse, assignmentResponse]) => {
        if (controller.signal.aborted) {
          return;
        }

        setTrainers(trainersResponse.trainers);
        setSelectedTrainer(assignmentResponse.trainer);

        const photoEntries = await Promise.all(
          trainersResponse.trainers
            .filter((trainer) => trainer.profilePhotoAvailable)
            .map(async (trainer) => {
              const photo = await getProfilePhoto(trainer.userId);
              const objectUrl = URL.createObjectURL(photo);
              objectUrls.push(objectUrl);
              return [trainer.userId, objectUrl] as const;
            }),
        );

        if (!controller.signal.aborted) {
          setProfilePhotos(Object.fromEntries(photoEntries));
        }
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            requestError instanceof ApiRequestError
              ? requestError.message
              : "We could not load trainers right now.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [getMyTrainer, getProfilePhoto, getTrainers]);

  async function chooseTrainer(trainer: Trainer) {
    setError(null);
    setIsAssigning(trainer.userId);

    try {
      await assignTrainer(trainer.userId);
      setSelectedTrainer(trainer);
    } catch (requestError) {
      setError(
        requestError instanceof ApiRequestError
          ? requestError.message
          : "We could not update your trainer.",
      );
    } finally {
      setIsAssigning(null);
    }
  }

  return (
    <section className="py-8 sm:py-10">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
        My Coach
      </p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight">Choose your trainer</h2>
      <p className="mt-3 max-w-2xl text-slate-300">
        Browse approved trainers and choose the coach who best matches your goals.
      </p>

      {selectedTrainer && (
        <div className="mt-6 rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-5 text-emerald-100">
          <p className="text-sm font-semibold uppercase tracking-[0.15em]">Current trainer</p>
          <p className="mt-2 text-lg font-semibold">{selectedTrainer.specialization}</p>
        </div>
      )}

      {error && (
        <p className="mt-6 text-sm text-rose-300" role="alert">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="mt-8 text-slate-300" aria-live="polite">
          Loading trainers…
        </p>
      ) : trainers.length === 0 ? (
        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
          No approved trainers are available yet.
        </div>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {trainers.map((trainer) => {
            const isSelected = selectedTrainer?.userId === trainer.userId;

            return (
              <article className="rounded-xl border border-slate-800 bg-slate-900 p-6" key={trainer.userId}>
                {profilePhotos[trainer.userId] ? (
                  <img
                    className="h-16 w-16 rounded-full object-cover"
                    src={profilePhotos[trainer.userId]}
                    alt={`${trainer.specialization} profile`}
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 text-xl font-semibold text-slate-300" aria-hidden="true">
                    FP
                  </div>
                )}
                <h3 className="mt-5 text-xl font-semibold">{trainer.specialization}</h3>
                <p className="mt-3 whitespace-pre-wrap text-slate-300">{trainer.biography}</p>
                <button
                  className="mt-6 rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  disabled={isSelected || isAssigning !== null}
                  onClick={() => void chooseTrainer(trainer)}
                >
                  {isSelected
                    ? "Your trainer"
                    : isAssigning === trainer.userId
                      ? "Updating…"
                      : selectedTrainer
                        ? "Choose this trainer"
                        : "Choose trainer"}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
