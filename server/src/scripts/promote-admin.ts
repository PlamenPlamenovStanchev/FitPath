import { eq } from "drizzle-orm";

function parseClerkUserId(argumentsList: string[]): string {
  const [flag, clerkUserId] = argumentsList;

  if (
    argumentsList.length !== 2 ||
    flag !== "--clerk-user-id" ||
    clerkUserId === undefined
  ) {
    throw new Error("Usage: npm run admin:promote -- --clerk-user-id user_xxx");
  }

  if (!/^user_[A-Za-z0-9]{1,120}$/.test(clerkUserId)) {
    throw new Error("--clerk-user-id must be a valid Clerk user ID.");
  }

  return clerkUserId;
}

async function promoteAdmin(clerkUserId: string): Promise<void> {
  const [{ db }, { users }] = await Promise.all([
    import("../db/client.js"),
    import("../db/schema.js"),
  ]);
  const [existingUser] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);

  if (!existingUser) {
    throw new Error(
      "No existing FitPath user was found for the supplied Clerk user ID.",
    );
  }

  if (existingUser.role === "ADMIN") {
    console.log(
      `FitPath user ${existingUser.id} is already ADMIN. Previous role: ADMIN. New role: ADMIN.`,
    );
    return;
  }

  const [promotedUser] = await db
    .update(users)
    .set({ role: "ADMIN", updatedAt: new Date() })
    .where(eq(users.id, existingUser.id))
    .returning({ id: users.id, role: users.role });

  if (!promotedUser) {
    throw new Error("Admin promotion did not update the FitPath user.");
  }

  console.log(
    `FitPath user ${promotedUser.id} promoted. Previous role: ${existingUser.role}. New role: ${promotedUser.role}.`,
  );
}

async function main(): Promise<void> {
  const clerkUserId = parseClerkUserId(process.argv.slice(2));
  await promoteAdmin(clerkUserId);
}

void main().catch((error: unknown) => {
  const safeMessages = new Set([
    "Usage: npm run admin:promote -- --clerk-user-id user_xxx",
    "--clerk-user-id must be a valid Clerk user ID.",
    "No existing FitPath user was found for the supplied Clerk user ID.",
  ]);
  const message =
    error instanceof Error && safeMessages.has(error.message)
      ? error.message
      : "Admin promotion failed.";
  console.error(message);
  process.exitCode = 1;
});
