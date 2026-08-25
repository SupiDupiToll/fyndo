export type PosLockMedia = {
  type: "image" | "video";
  url: string;
};

export type PosSettings = {
  lockScreenEnabled: boolean;
  idleTimeoutSeconds: number;
  lockWarningSeconds: number;
  showOnLoad: boolean;
  successAutoLockSeconds: number;
  media: PosLockMedia[];
  adminEnabled: boolean;
  adminCodeHash: string;
};

export const POS_SETTINGS_DEFAULTS: PosSettings = {
  lockScreenEnabled: true,
  idleTimeoutSeconds: 60,
  lockWarningSeconds: 5,
  showOnLoad: true,
  successAutoLockSeconds: 15,
  media: [],
  adminEnabled: false,
  adminCodeHash: "",
};

export function parsePosSettings(raw: unknown): PosSettings {
  if (!raw || typeof raw !== "object") return { ...POS_SETTINGS_DEFAULTS };
  const obj = raw as Record<string, unknown>;

  const media = Array.isArray(obj.media)
    ? obj.media
        .filter(
          (m): m is { type: string; url: string } =>
            !!m &&
            typeof m === "object" &&
            ((m as PosLockMedia).type === "image" || (m as PosLockMedia).type === "video") &&
            typeof (m as PosLockMedia).url === "string",
        )
        .map((m) => ({
          type: m.type as "image" | "video",
          url: (m.url as string).trim(),
        }))
        .filter((m) => m.url !== "")
    : [];

  return {
    lockScreenEnabled:
      typeof obj.lockScreenEnabled === "boolean"
        ? obj.lockScreenEnabled
        : POS_SETTINGS_DEFAULTS.lockScreenEnabled,
    idleTimeoutSeconds:
      typeof obj.idleTimeoutSeconds === "number" && obj.idleTimeoutSeconds > 0
        ? Math.round(obj.idleTimeoutSeconds)
        : POS_SETTINGS_DEFAULTS.idleTimeoutSeconds,
    lockWarningSeconds:
      typeof obj.lockWarningSeconds === "number" && obj.lockWarningSeconds >= 1
        ? Math.round(obj.lockWarningSeconds)
        : POS_SETTINGS_DEFAULTS.lockWarningSeconds,
    showOnLoad:
      typeof obj.showOnLoad === "boolean" ? obj.showOnLoad : POS_SETTINGS_DEFAULTS.showOnLoad,
    successAutoLockSeconds:
      typeof obj.successAutoLockSeconds === "number" && obj.successAutoLockSeconds >= 0
        ? Math.round(obj.successAutoLockSeconds)
        : POS_SETTINGS_DEFAULTS.successAutoLockSeconds,
    media,
    adminEnabled:
      typeof obj.adminEnabled === "boolean" ? obj.adminEnabled : POS_SETTINGS_DEFAULTS.adminEnabled,
    adminCodeHash:
      typeof obj.adminCodeHash === "string"
        ? obj.adminCodeHash
        : POS_SETTINGS_DEFAULTS.adminCodeHash,
  };
}
