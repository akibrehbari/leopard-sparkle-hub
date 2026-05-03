/**
 * Shared axios instance for all browser-side API calls.
 *
 * baseURL is the origin only (e.g. http://localhost:3000 in dev,
 * https://leopard-sparkle-hub.vercel.app in prod). Each service class defines
 * its own BASE_PATH constant and prepends it to every request path, so the
 * full URL becomes: origin + BASE_PATH + endpoint.
 *
 * Responsibilities:
 *   - Single axios instance shared across all service classes.
 *   - Response interceptor that maps non-2xx into ApiError with a typed
 *     `status` field, which the QueryClient retry policy reads to bail on 4xx.
 */

import axios from "axios";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const api = axios.create({
  baseURL: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
  withCredentials: true,
  headers: { Accept: "application/json" },
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (axios.isAxiosError(err) && err.response) {
      const { status, data } = err.response;
      const message: string =
        (data as { error?: string })?.error ??
        `Request failed (${status}) for ${err.config?.url ?? "unknown"}`;
      return Promise.reject(new ApiError(message, status));
    }
    return Promise.reject(err);
  },
);

export default api;
