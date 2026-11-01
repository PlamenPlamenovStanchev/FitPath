import { useEffect, useRef, useState } from "react";

import {
  ApiRequestError,
  type ProgressPhoto,
  type ProgressEntriesResponse,
  type ProgressPhotosResponse,
  type WorkoutCompletionsResponse,
} from "../api/client";
import { ProgressCharts } from "./ProgressCharts";

const maximumPhotoSizeBytes = 5 * 1024 * 1024;
const allowedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

type ProgressPhotosPageProps = {
  getPhotos: (signal?: AbortSignal) => Promise<ProgressPhotosResponse>;
  uploadPhoto: (photo: File) => Promise<ProgressPhoto>;
  getPhoto: (photoId: string) => Promise<Blob>;
  deletePhoto: (photoId: string) => Promise<void>;
  getProgress: (signal?: AbortSignal) => Promise<ProgressEntriesResponse>;
  getCompletions: (signal?: AbortSignal) => Promise<WorkoutCompletionsResponse>;
};

function validatePhoto(photo: File | null): string | null {
  if (!photo) return "Choose a JPEG, PNG, or WebP image to upload.";
  if (!allowedPhotoTypes.has(photo.type))
    return "Progress photos must be JPEG, PNG, or WebP images.";
  if (photo.size === 0 || photo.size > maximumPhotoSizeBytes)
    return "Progress photos must be 5 MB or smaller.";
  return null;
}

export function ProgressPhotosPage({
  getPhotos,
  uploadPhoto,
  getPhoto,
  deletePhoto,
  getProgress,
  getCompletions,
}: ProgressPhotosPageProps) {
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const objectUrlsRef = useRef(new Set<string>());
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let isCurrent = true;

    void getPhotos(controller.signal)
      .then(async (response) => {
        const imageResults = await Promise.allSettled(
          response.photos.map(async (photo) => {
            const image = await getPhoto(photo.id);
            const imageUrl = URL.createObjectURL(image);
            objectUrlsRef.current.add(imageUrl);
            return [photo.id, imageUrl] as const;
          }),
        );
        const imageEntries = imageResults.flatMap((result) =>
          result.status === "fulfilled" ? [result.value] : [],
        );

        if (isCurrent) {
          setPhotos(response.photos);
          setPhotoUrls(Object.fromEntries(imageEntries));
        } else {
          imageEntries.forEach(([, url]) => {
            URL.revokeObjectURL(url);
            objectUrlsRef.current.delete(url);
          });
        }
      })
      .catch((requestError: unknown) => {
        if (isCurrent) {
          setError(
            requestError instanceof ApiRequestError
              ? requestError.message
              : "We could not load progress photos.",
          );
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [getPhoto, getPhotos]);

  useEffect(
    () => () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current.clear();
    },
    [],
  );

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("photo") as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    const validationError = validatePhoto(file);

    if (validationError || !file) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsUploading(true);
    try {
      const photo = await uploadPhoto(file);
      const image = await getPhoto(photo.id);
      const imageUrl = URL.createObjectURL(image);
      objectUrlsRef.current.add(imageUrl);
      setPhotos((current) => [photo, ...current]);
      setPhotoUrls((current) => ({ ...current, [photo.id]: imageUrl }));
      form.reset();
    } catch (requestError) {
      setError(
        requestError instanceof ApiRequestError
          ? requestError.message
          : "We could not upload this progress photo.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(photoId: string) {
    if (deletingPhotoId) return;
    setError(null);
    setDeletingPhotoId(photoId);
    try {
      await deletePhoto(photoId);
      setPhotos((current) => current.filter((photo) => photo.id !== photoId));
      setPhotoUrls((current) => {
        const url = current[photoId];
        if (url) {
          URL.revokeObjectURL(url);
          objectUrlsRef.current.delete(url);
        }
        const next = { ...current };
        delete next[photoId];
        return next;
      });
    } catch (requestError) {
      setError(
        requestError instanceof ApiRequestError
          ? requestError.message
          : "We could not delete this progress photo.",
      );
    } finally {
      setDeletingPhotoId(null);
    }
  }

  return (
    <section className="py-8 sm:py-10">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
        Progress
      </p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight">Your progress</h2>
      <p className="mt-3 max-w-2xl text-slate-300">
        Review your recorded progress and keep private visual records of your
        fitness journey.
      </p>

      <ProgressCharts
        getProgress={getProgress}
        getCompletions={getCompletions}
      />

      <h3 className="mt-10 text-xl font-semibold">Progress photos</h3>
      <form
        className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-5"
        onSubmit={(event) => void handleUpload(event)}
      >
        <label className="block text-sm font-medium" htmlFor="progress-photo">
          Upload a photo (JPEG, PNG, or WebP; maximum 5 MB)
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            id="progress-photo"
            name="photo"
            className="max-w-full text-sm text-slate-300"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={isUploading}
          />
          <button
            className="rounded-md bg-emerald-400 px-4 py-2 font-semibold text-slate-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={isUploading}
          >
            {isUploading ? "Uploading…" : "Upload photo"}
          </button>
        </div>
      </form>

      {error && (
        <p className="mt-5 text-sm text-rose-300" role="alert">
          {error}
        </p>
      )}

      {isLoading ? (
        <p className="mt-8 text-slate-300" aria-live="polite">
          Loading progress photos…
        </p>
      ) : photos.length === 0 ? (
        <p className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-5 text-slate-300">
          No progress photos yet.
        </p>
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <li
              className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900"
              key={photo.id}
            >
              {photoUrls[photo.id] ? (
                <img
                  className="aspect-square w-full object-cover"
                  src={photoUrls[photo.id]}
                  alt={`Progress photo from ${new Date(photo.createdAt).toLocaleDateString()}`}
                />
              ) : (
                <div className="aspect-square bg-slate-800" />
              )}
              <div className="flex items-center justify-between gap-3 p-4">
                <time
                  className="text-sm text-slate-400"
                  dateTime={photo.createdAt}
                >
                  {new Date(photo.createdAt).toLocaleDateString()}
                </time>
                <button
                  className="rounded-md border border-rose-400 px-3 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-400/10 disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  disabled={deletingPhotoId !== null}
                  onClick={() => void handleDelete(photo.id)}
                >
                  {deletingPhotoId === photo.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
