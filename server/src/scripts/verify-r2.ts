import {
  createConnectivityTestObjectKey,
} from "../storage/object-keys.js";
import {
  deleteObject,
  getObject,
  uploadObject,
} from "../storage/r2.js";

const key = createConnectivityTestObjectKey();
const expectedContents = "FitPath R2 connectivity check";
let uploaded = false;

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("$metadata" in error)) {
    return false;
  }

  const metadata = error.$metadata;

  return (
    typeof metadata === "object" &&
    metadata !== null &&
    "httpStatusCode" in metadata &&
    metadata.httpStatusCode === 404
  );
}

async function verifyObjectWasDeleted(): Promise<void> {
  try {
    await getObject(key);
  } catch (error) {
    if (isNotFoundError(error)) {
      return;
    }

    throw error;
  }

  throw new Error("R2 object remained accessible after deletion");
}

try {
  await uploadObject({
    key,
    body: Buffer.from(expectedContents, "utf8"),
    contentType: "text/plain; charset=utf-8",
  });
  uploaded = true;
  console.log("UPLOAD   PASS");

  const contents = (await getObject(key)).toString("utf8");

  if (contents !== expectedContents) {
    throw new Error("Retrieved object contents did not match the uploaded value");
  }

  console.log("READ     PASS");

  await deleteObject(key);
  uploaded = false;
  await verifyObjectWasDeleted();
  console.log("DELETE   PASS");
} catch (error) {
  if (uploaded) {
    try {
      await deleteObject(key);
    } catch {
      console.error("Cleanup failed; remove the R2 connectivity test object manually.");
    }
  }

  throw error;
}
