// In-memory registry that records the shape of the last response for a repo call.
// Used by /dev/data-health to visualise the data layer contract.

export type RegistryEntry = {
  key: string;
  scope: string;
  at: number;
  count: number | null;
  kind: "list" | "item";
  ok: boolean;
  issues: string[];
  sampleKeys: string[];
};

const store = new Map<string, RegistryEntry>();
const MAX = 200;

export function recordEntry(entry: RegistryEntry) {
  if (store.size >= MAX && !store.has(entry.key)) {
    const firstKey = store.keys().next().value;
    if (firstKey) store.delete(firstKey);
  }
  store.set(entry.key, entry);
}

export function listEntries(): RegistryEntry[] {
  return [...store.values()].sort((a, b) => b.at - a.at);
}
