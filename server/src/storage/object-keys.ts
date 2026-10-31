import { randomUUID } from "node:crypto";

export const maximumUploadSizeBytes = 5 * 1024 * 1024;

const fileUploadPolicies = {
  avatars: {
    allowedMimeTypes: {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    },
  },
  "trainer-certificates": {
    allowedMimeTypes: {
      "application/pdf": "pdf",
    },
  },
} as const;

const privateObjectPrefixes = [
  "avatars",
  "trainer-certificates",
  "progress-photos",
  "_test",
] as const;

export type FileUploadCategory = keyof typeof fileUploadPolicies;
type AllowedMimeType<C extends FileUploadCategory> = keyof (typeof fileUploadPolicies)[C]["allowedMimeTypes"];

export function createUploadObjectKey(
  category: FileUploadCategory,
  contentType: string,
  contentLength: number,
): string {
  if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
    throw new Error("Upload content length must be a positive integer");
  }

  if (contentLength > maximumUploadSizeBytes) {
    throw new Error("Upload exceeds the 5 MB file size limit");
  }

  const policy = fileUploadPolicies[category];
  const extension = policy.allowedMimeTypes[
    contentType as AllowedMimeType<typeof category>
  ];

  if (!extension) {
    throw new Error(`Unsupported ${category} content type`);
  }

  return `${category}/${randomUUID()}.${extension}`;
}

export function createConnectivityTestObjectKey(): string {
  return `_test/connectivity-${randomUUID()}.txt`;
}

export function assertPrivateObjectKey(key: string): void {
  const [prefix] = key.split("/", 1);
  const hasAllowedPrefix = privateObjectPrefixes.includes(
    prefix as (typeof privateObjectPrefixes)[number],
  );
  const hasUnsafePathSegment = key
    .split("/")
    .some((segment) => segment.length === 0 || segment === "." || segment === "..");

  if (
    !hasAllowedPrefix ||
    key.includes("\\") ||
    key.startsWith("/") ||
    hasUnsafePathSegment
  ) {
    throw new Error("Invalid private object key");
  }
}
