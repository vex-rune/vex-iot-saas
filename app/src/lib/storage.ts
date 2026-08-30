/**
 * localStorage 工具:统一命名空间
 */
const PREFIX = 'vex.iot.';

export const storage = {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* quota or private mode */
    }
  },
  remove(key: string) {
    localStorage.removeItem(PREFIX + key);
  },
  getString(key: string): string | null {
    try {
      return localStorage.getItem(PREFIX + key);
    } catch {
      return null;
    }
  },
  setString(key: string, value: string) {
    try {
      localStorage.setItem(PREFIX + key, value);
    } catch {
      /* ignore */
    }
  },
};
