// Constants and enums are defined once here (AGENTS.md Rule 4).
// Business logic must not hard-code these values elsewhere.

export const APP_NAME = "KantorCore" as const;

/** Bahasa Indonesia is the default; English is second (Rule 24). */
export const DEFAULT_LOCALE = "id-ID" as const;
export const SUPPORTED_LOCALES = ["id-ID", "en-US"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** Timestamps are stored in UTC (ARCH §20); display uses company time zone. */
export const STORAGE_TIMEZONE = "UTC" as const;

/** Base currency for the principal (ARCH §20). */
export const BASE_CURRENCY = "IDR" as const;
