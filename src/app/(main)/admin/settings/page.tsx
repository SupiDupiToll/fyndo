"use client";

import { useEffect, useState } from "react";

export default function AdminSettingsPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold tracking-tight mb-2">Zahlungseinstellungen</h1>
      <p className="text-mute">
        Alle Zahlungen werden über das zentrale R-Bank-System abgewickelt.
      </p>
    </div>
  );
}
