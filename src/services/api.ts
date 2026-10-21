import { useSyncExternalStore } from "react";

declare const process: { env: { EXPO_PUBLIC_API_BASE_URL?: string } };

export type User = { id: number; username: string; email: string };
type Session = { token: string; user: User };

// Intentionally memory-only: restarting the app requires signing in again.
let session: Session | null = null;
const listeners = new Set<() => void>();
function setSession(value: Session | null) {
  session = value;
  listeners.forEach(listener => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function useSession() {
  return useSyncExternalStore(subscribe, () => session, () => null);
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function request<T>(path: string, options: RequestInit = {}, authenticated = true): Promise<T> {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) throw new Error("Set EXPO_PUBLIC_API_BASE_URL and restart the app");
  const token = authenticated ? session?.token : undefined;
  if (authenticated && !token) throw new ApiError(401, "Please sign in");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
    });
  } catch {
    throw new Error("Cannot reach the server. Check your connection and try again");
  } finally {
    clearTimeout(timeout);
  }
  if (response.status === 401 && token && session?.token === token) setSession(null);
  if (response.status === 204) return undefined as T;
  const body = await response.json();
  if (!response.ok) throw new ApiError(response.status, body.error || "Request failed");
  return body as T;
}

export async function signIn(email: string, password: string) {
  const result = await request<Session>("/auth/login", {
    method: "POST", body: JSON.stringify({ email, password }),
  }, false);
  setSession(result);
}

export async function signUp(username: string, email: string, password: string) {
  const result = await request<Session>("/auth/signup", {
    method: "POST", body: JSON.stringify({ username, email, password }),
  }, false);
  setSession(result);
}

export async function signOut() {
  const token = session?.token;
  await request<void>("/auth/logout", { method: "POST" });
  if (session?.token === token) setSession(null);
}
