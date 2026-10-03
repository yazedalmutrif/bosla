// localStorage can be unavailable (private mode, blocked storage). Never let that break the page.
const PREFIX = "bosla.";

export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(PREFIX + key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(PREFIX + key, value);
    } catch {
      /* ignore */
    }
  },
};

let memoryId: string | null = null;

/** Random per-browser id used only for the daily run limit (hashed on the server). */
export function clientId(): string {
  const saved = storage.get("cid");
  if (saved && /^[0-9a-f-]{36}$/i.test(saved)) return saved;
  const id = crypto.randomUUID();
  storage.set("cid", id);
  memoryId ??= id;
  return storage.get("cid") ?? memoryId;
}
