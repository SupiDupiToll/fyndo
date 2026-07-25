import { hexclaveServerApp } from "@/hexclave/server";

export function getLoginUrl(): string {
  const app = hexclaveServerApp();
  return "/handler/sign-in";
}
