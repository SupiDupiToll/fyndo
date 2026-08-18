export const dynamic = "force-dynamic";

export default function DemoAdminSettingsPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold tracking-tight mb-2">Zahlungseinstellungen</h1>
      <p className="text-mute">
        Alle Zahlungen werden über das zentrale R-Bank-System abgewickelt.
      </p>
      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
        <i className="fa-solid fa-flask mr-2" />
        Demo: Die Einstellungen sind hier nicht veränderbar.
      </div>
    </div>
  );
}
