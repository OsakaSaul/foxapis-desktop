/**
 * Bearer-token storage. Uses Tauri's keyring-backed Store plugin in
 * production; falls back to localStorage when run in a plain browser
 * (e.g. `npm run dev` without a Tauri shell, useful for pure-frontend
 * iteration).
 *
 * @version v0.1
 */

let storeP: Promise<any> | null = null;
async function getStore() {
  if (!storeP) {
    try {
      const { Store } = await import("@tauri-apps/plugin-store");
      storeP = (Store as any).load("auth.dat").catch(() => null);
    } catch {
      storeP = Promise.resolve(null);
    }
  }
  return storeP;
}

const KEY = "mentionfox_bearer";

export async function setToken(token: string): Promise<void> {
  const store = await getStore();
  if (store) {
    await store.set(KEY, token);
    await store.save();
    return;
  }
  try {
    localStorage.setItem(KEY, token);
  } catch {
    // ignore
  }
}

export async function getToken(): Promise<string | null> {
  const store = await getStore();
  if (store) {
    const v = await store.get(KEY);
    return (v as string) || null;
  }
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function clearToken(): Promise<void> {
  const store = await getStore();
  if (store) {
    await store.delete(KEY);
    await store.save();
    return;
  }
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Tell the local relay to reload its in-memory copy of the token. */
export async function pushTokenToRelay(token: string): Promise<boolean> {
  try {
    const r = await fetch("http://127.0.0.1:8732/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bearer: token }),
    });
    return r.ok;
  } catch {
    return false;
  }
}
