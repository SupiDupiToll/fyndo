"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function GateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password === "123") {
      document.cookie = "gate_pass=123; path=/; max-age=86400; SameSite=Lax";
      const redirect = searchParams.get("redirect") || "/";
      router.push(redirect);
    } else {
      setError(true);
      setPassword("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Zugang</h1>
      <p className="text-sm text-mute">Bitte Passwort eingeben</p>
      <input
        type="password"
        value={password}
        onChange={(e) => { setPassword(e.target.value); setError(false); }}
        className="w-full max-w-xs rounded-xl border border-line bg-white px-5 py-3 text-center text-lg outline-none focus:border-accent transition-colors"
        autoFocus
      />
      {error && <p className="text-sm text-red-500">Falsches Passwort</p>}
      <button
        type="submit"
        className="rounded-xl bg-accent px-8 py-3 text-sm font-bold text-white hover:bg-accent-hover transition-colors"
      >
        Eintreten
      </button>
    </form>
  );
}

export default function GatePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surf px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-8 shadow-sm">
        <Suspense fallback={null}>
          <GateForm />
        </Suspense>
      </div>
    </div>
  );
}
