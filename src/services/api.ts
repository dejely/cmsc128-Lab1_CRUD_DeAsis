import * as SecureStore from "expo-secure-store";

declare const process: { env: { EXPO_PUBLIC_API_BASE_URL?: string } };
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const TOKEN_KEY = "cmsc128-auth-token";
const unauthorizedListeners = new Set<() => void>();
let tokenGeneration = 0;
let tokenWrites: Promise<void> = Promise.resolve();

export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

function writeToken(operation: () => Promise<void>) {
  tokenGeneration++;
  const pending = tokenWrites.then(operation);
  tokenWrites = pending.catch(() => {});
  return pending;
}
async function getToken() {
  await tokenWrites;
  return SecureStore.getItemAsync(TOKEN_KEY);
}
export function saveAuthToken(token: string) {
  return writeToken(() => SecureStore.setItemAsync(TOKEN_KEY, token));
}
export function getAuthToken() { return getToken(); }
export function removeAuthToken() {
  return writeToken(() => SecureStore.deleteItemAsync(TOKEN_KEY));
}
export function subscribeToUnauthorized(listener: () => void) {
  unauthorizedListeners.add(listener);
  return () => { unauthorizedListeners.delete(listener); };
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, authenticated = true): Promise<T> {
  if (!API_BASE_URL) throw new ApiError(0, "Set EXPO_PUBLIC_API_BASE_URL and restart the app");
  const token = authenticated ? await getToken() : null;
  const generation = tokenGeneration;
  if (authenticated && !token) throw new ApiError(401, "Please sign in");
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    let response: Response;
    let text: string;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, signal: controller.signal });
      text = await response.text();
    } catch {
      throw new ApiError(0, "Network request failed. Check your connection and try again");
    }
    if (response.status === 401 && token && generation === tokenGeneration && token === await getToken() && generation === tokenGeneration) {
      const removalGeneration = tokenGeneration + 1;
      await removeAuthToken();
      if (removalGeneration === tokenGeneration) unauthorizedListeners.forEach(listener => listener());
    }
    let data: any = null;
    if (text) {
      try { data = JSON.parse(text); }
      catch { throw new ApiError(response.status, "Server returned an invalid response"); }
    }
    if (!response.ok) throw new ApiError(response.status, data?.error || `Request failed with status ${response.status}`, data);
    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}

export type AuthUser = {
  id: number;
  username: string;
  email: string;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

export type ProfileResponse = {
  user: AuthUser;
};

export type ServerTodo = {
  id: number;
  title: string;
  completed: number;
  dueDate: string | null;
  priority: "Low" | "Medium" | "High";
  category: "School" | "Personal" | "Others";
  clientId: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  deletedAt: string | null;
};

export type SyncOperationResponse = {
  ok: boolean;
  operationId: string;
  applied: boolean;
  conflict: boolean;
  gone?: boolean;
  error?: string;
  todo?: ServerTodo | null;
};

export type SyncResponse = {
  results: SyncOperationResponse[];
  todos: ServerTodo[];
};

export function register(username: string, email: string, password: string) {
  return apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  }, false);
}

export function login(identifier: string, password: string) {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  }, false);
}

export function getMe() {
  return apiRequest<ProfileResponse>("/auth/me");
}

export function updateMe(username: string, email: string) {
  return apiRequest<ProfileResponse>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify({ username, email }),
  });
}

export function requestPasswordReset(email: string) {
  return apiRequest<{ message: string }>("/auth/reset-request", {
    method: "POST",
    body: JSON.stringify({ email }),
  }, false);
}

export function confirmPasswordReset(token: string, newPassword: string) {
  return apiRequest<{ message: string }>("/auth/reset-confirm", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  }, false);
}

export function syncTodos(operations: unknown[]) {
  return apiRequest<SyncResponse>("/todos/sync", {
    method: "POST",
    body: JSON.stringify({ operations }),
  });
}

export function logout() {
  return apiRequest<void>("/auth/logout", { method: "POST" });
}
