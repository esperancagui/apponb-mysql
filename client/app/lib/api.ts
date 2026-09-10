/**
 * API Client — Abstração HTTP centralizada para o backend FastAPI.
 */

import { ApiResponse } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

/** Generic request handler */
async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const url = `${API_URL}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  // Only attach the token in browser environments (Firebase SDK is client-only)
  if (typeof window !== "undefined") {
    try {
      const { auth } = await import("./firebase");
      // Wait for Firebase to restore auth state after a hard refresh
      await auth.authStateReady();
      const token = await auth.currentUser?.getIdToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    } catch {
      // Not authenticated — proceed without token
    }
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      const detail = typeof errorBody.detail === "string" ? errorBody.detail : undefined;
      return {
        data: null as unknown as T,
        error: detail || errorBody.message || `HTTP ${res.status}: ${res.statusText}`,
      };
    }

    if (res.status === 204 || res.headers.get("content-length") === "0") {
      return { data: null as unknown as T };
    }

    const data = await res.json();
    return { data };
  } catch (err) {
    return {
      data: null as unknown as T,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

/** Typed HTTP methods */
export const api = {
  get<T>(path: string): Promise<ApiResponse<T>> {
    return request<T>(path, { method: "GET" });
  },

  post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return request<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return request<T>(path, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete<T>(path: string): Promise<ApiResponse<T>> {
    return request<T>(path, { method: "DELETE" });
  },
};
