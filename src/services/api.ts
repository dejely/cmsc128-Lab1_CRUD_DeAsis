import * as SecureStore from "expo-secure-store";

const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3000"
).replace(/\/+$/, "");

const TOKEN_KEY = "cmsc128-auth-token";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function getToken() {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function saveAuthToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getAuthToken() {
  return getToken();
}

export async function removeAuthToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new ApiError(0, "Network request failed.");
  }

  let data: any = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.error || data?.message || `Request failed with status ${response.status}.`,
      data,
    );
  }

  return data as T;
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
  });
}

export function login(identifier: string, password: string) {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });
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
  });
}

export function confirmPasswordReset(token: string, newPassword: string) {
  return apiRequest<{ message: string }>("/auth/reset-confirm", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  });
}

export function syncTodos(operations: unknown[]) {
  return apiRequest<SyncResponse>("/todos/sync", {
    method: "POST",
    body: JSON.stringify({ operations }),
  });
}
