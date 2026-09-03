/**
 * phone-truth — parse + validate phone numbers via libphonenumber-js.
 *
 * libphonenumber is Google's reference impl; libphonenumber-js is the
 * battle-tested JS port. Handles E.164, national format, parsing from
 * messy human input ("+91 (98) 1234-5678"), country / region detection,
 * line-type heuristics (mobile / fixed-line / voip / toll-free).
 *
 * Competes with Twilio Lookup, Numverify. Carrier-name lookups need a
 * paid HLR provider — we deliberately skip that here; everything else is
 * offline.
 */

import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export type PhoneTruthInput = {
  phone: string;
  defaultCountry?: string;
};

export type PhoneTruthLineType =
  | "mobile"
  | "fixed_line"
  | "fixed_line_or_mobile"
  | "toll_free"
  | "premium_rate"
  | "shared_cost"
  | "voip"
  | "personal_number"
  | "pager"
  | "uan"
  | "unknown";

export type PhoneTruthResult = {
  phone: string;
  valid: boolean;
  possible: boolean;
  country: string | null;
  countryCallingCode: string | null;
  national: string | null;
  international: string | null;
  e164: string | null;
  rfc3966: string | null;
  uri: string | null;
  type: PhoneTruthLineType;
  isMobile: boolean;
  isFixed: boolean;
  isTollFree: boolean;
  isPremium: boolean;
  isVoip: boolean;
  durationMs: number;
};

const NUMBER_TYPE_MAP: Record<string, PhoneTruthLineType> = {
  MOBILE: "mobile",
  FIXED_LINE: "fixed_line",
  FIXED_LINE_OR_MOBILE: "fixed_line_or_mobile",
  TOLL_FREE: "toll_free",
  PREMIUM_RATE: "premium_rate",
  SHARED_COST: "shared_cost",
  VOIP: "voip",
  PERSONAL_NUMBER: "personal_number",
  PAGER: "pager",
  UAN: "uan",
};

export function runPhoneTruth(input: PhoneTruthInput): PhoneTruthResult {
  const startedAt = performance.now();
  const raw = (input.phone ?? "").trim();
  if (!raw) throw new Error("phone is required");
  if (raw.length > 60) throw new Error("phone too long");

  const defaultCountry = (input.defaultCountry ?? "").toUpperCase() || undefined;
  if (defaultCountry !== undefined && !/^[A-Z]{2}$/.test(defaultCountry)) {
    throw new Error("defaultCountry must be a 2-letter ISO 3166-1 code");
  }

  const parsed = parsePhoneNumberFromString(raw, defaultCountry as CountryCode | undefined);

  if (!parsed) {
    return {
      phone: raw,
      valid: false,
      possible: false,
      country: null,
      countryCallingCode: null,
      national: null,
      international: null,
      e164: null,
      rfc3966: null,
      uri: null,
      type: "unknown",
      isMobile: false,
      isFixed: false,
      isTollFree: false,
      isPremium: false,
      isVoip: false,
      durationMs: Math.round(performance.now() - startedAt),
    };
  }

  const typeRaw = parsed.getType() ?? "UNKNOWN";
  const type = NUMBER_TYPE_MAP[typeRaw] ?? "unknown";

  return {
    phone: raw,
    valid: parsed.isValid(),
    possible: parsed.isPossible(),
    country: parsed.country ?? null,
    countryCallingCode: parsed.countryCallingCode ?? null,
    national: parsed.formatNational(),
    international: parsed.formatInternational(),
    e164: parsed.number,
    rfc3966: parsed.format("RFC3966"),
    uri: parsed.getURI(),
    type,
    isMobile: type === "mobile" || type === "fixed_line_or_mobile",
    isFixed: type === "fixed_line" || type === "fixed_line_or_mobile",
    isTollFree: type === "toll_free",
    isPremium: type === "premium_rate",
    isVoip: type === "voip",
    durationMs: Math.round(performance.now() - startedAt),
  };
}
