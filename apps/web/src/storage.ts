/**
 * localStorage that never throws: private windows and blocked site data just make the
 * game forget things between page loads.
 */
export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null): void {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
  getJson<T>(key: string): T | null {
    const raw = this.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  setJson(key: string, value: unknown | null): void {
    this.set(key, value === null ? null : JSON.stringify(value));
  },
};

export const KEYS = {
  session: 'esm-famil.session',
  name: 'esm-famil.name',
} as const;
