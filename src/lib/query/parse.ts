import type { z } from "zod";

import { logger } from "@/lib/logger";
import { recordEntry } from "@/lib/query/registry";

function unwrap(raw: unknown): unknown {
  if (raw == null) return raw;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    // Common envelope shapes returned by server functions.
    for (const key of ["data", "items", "rows", "results", "events", "list"]) {
      if (Array.isArray(obj[key])) return obj[key];
    }
  }
  return raw;
}

function keysOf(sample: unknown): string[] {
  if (sample && typeof sample === "object" && !Array.isArray(sample)) {
    return Object.keys(sample as Record<string, unknown>).slice(0, 12);
  }
  return [];
}

/**
 * Parse an unknown response into a validated array.
 * Never throws — logs and returns [] on failure so UI stays stable.
 */
export function parseList<S extends z.ZodTypeAny>(
  scope: string,
  schema: S,
  raw: unknown,
): z.infer<S>[] {
  const source = unwrap(raw);
  const arr = Array.isArray(source) ? source : [];
  const issues: string[] = [];
  const out: z.infer<S>[] = [];

  if (!Array.isArray(source)) {
    issues.push(`expected array, got ${typeof raw}`);
    logger.warn(`data:${scope}`, "response was not an array", {
      type: typeof raw,
      keys: raw && typeof raw === "object" ? Object.keys(raw as object).slice(0, 8) : [],
    });
  }

  for (const item of arr) {
    const res = schema.safeParse(item);
    if (res.success) {
      out.push(res.data);
    } else {
      issues.push(res.error.issues[0]?.message ?? "invalid item");
    }
  }

  if (issues.length) {
    logger.warn(`data:${scope}`, `list validation issues (${issues.length})`, {
      first: issues[0],
      total: arr.length,
    });
  }

  recordEntry({
    key: `list:${scope}`,
    scope,
    at: Date.now(),
    count: out.length,
    kind: "list",
    ok: issues.length === 0,
    issues: issues.slice(0, 5),
    sampleKeys: keysOf(arr[0]),
  });

  return out;
}

/**
 * Parse an unknown response into a validated single item or null.
 * Never throws.
 */
export function parseOne<S extends z.ZodTypeAny>(
  scope: string,
  schema: S,
  raw: unknown,
): z.infer<S> | null {
  if (raw == null) {
    recordEntry({
      key: `item:${scope}`,
      scope,
      at: Date.now(),
      count: 0,
      kind: "item",
      ok: true,
      issues: [],
      sampleKeys: [],
    });
    return null;
  }
  const res = schema.safeParse(raw);
  if (!res.success) {
    logger.warn(`data:${scope}`, "item validation failed", {
      first: res.error.issues[0]?.message,
      keys: keysOf(raw),
    });
    recordEntry({
      key: `item:${scope}`,
      scope,
      at: Date.now(),
      count: null,
      kind: "item",
      ok: false,
      issues: res.error.issues.slice(0, 5).map((i) => i.message),
      sampleKeys: keysOf(raw),
    });
    return null;
  }
  recordEntry({
    key: `item:${scope}`,
    scope,
    at: Date.now(),
    count: 1,
    kind: "item",
    ok: true,
    issues: [],
    sampleKeys: keysOf(raw),
  });
  return res.data;
}
