import "server-only";
import { cache } from "react";
import { hexclaveServerApp } from "@/hexclave/server";
import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

type HexclaveApp = ReturnType<typeof hexclaveServerApp>;
type StackUser = Awaited<ReturnType<HexclaveApp['getUser']>>;

function getString(value: string | null | undefined): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}

function resolveDisplayName(user: StackUser, email: string): string {
  const displayName = getString(user?.displayName);
  if (displayName) return displayName;
  return email || "Gast";
}

function getAdminEmails(): Set<string> {
  const rawEmails = process.env.HEXCLAVE_ADMIN_EMAILS ?? process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "";

  return new Set(
    rawEmails
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

async function upsertUserFromStackUser(user: StackUser): Promise<User | null> {
  if (!user) return null;

  const stackUserId = getString(user.id);
  const email = getString(user.primaryEmail);

  if (!stackUserId || !email) return null;

  const normalizedEmail = email.toLowerCase();
  const displayName = resolveDisplayName(user, normalizedEmail);
  const adminEmails = getAdminEmails();

  const existingUser = await prisma.user.findUnique({ where: { stackUserId } });

  let role: "SUPER_ADMIN" | "SELLER" | "USER" = "USER";
  if (existingUser?.role === "SUPER_ADMIN" || existingUser?.role === "SELLER") {
    role = existingUser.role;
  } else if (adminEmails.has(normalizedEmail)) {
    role = "SUPER_ADMIN";
  }

  return prisma.user.upsert({
    where: { stackUserId },
    update: {
      email: normalizedEmail,
      displayName,
      role,
    },
    create: {
      stackUserId,
      email: normalizedEmail,
      displayName,
      role,
    },
  });
}

export async function syncUserFromSession(): Promise<User | null> {
  const user = await hexclaveServerApp().getUser({ or: "return-null" });
  return upsertUserFromStackUser(user);
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  try {
    return await syncUserFromSession();
  } catch {
    return null;
  }
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function requireSuperAdmin() {
  const user = await requireUser();
  if (user.role !== "SUPER_ADMIN") throw new Error("FORBIDDEN");
  return user;
}

export async function requireSellerOrSuperAdmin() {
  const user = await requireUser();
  if (user.role !== "SELLER" && user.role !== "SUPER_ADMIN") throw new Error("FORBIDDEN");
  return user;
}
