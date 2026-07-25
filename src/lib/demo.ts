import type { User } from "@/generated/prisma/client";

export const DEMO_EMAIL_DOMAIN = "rundishop.sdtoll.de";

export function isDemoEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const atIndex = normalizedEmail.lastIndexOf("@");

  if (atIndex <= 0 || atIndex === normalizedEmail.length - 1) return false;

  const localPart = normalizedEmail.slice(0, atIndex);
  const domain = normalizedEmail.slice(atIndex + 1);

  return localPart.endsWith("-demo") || domain === DEMO_EMAIL_DOMAIN;
}

export function isDemoUser(user: Pick<User, "email"> | null | undefined) {
  return Boolean(user?.email && isDemoEmail(user.email));
}
