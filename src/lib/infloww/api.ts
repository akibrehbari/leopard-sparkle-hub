/**
 * Browser-side axios instance for the eLeopards proxy API.
 *
 * This instance talks to our own Next.js route handlers (/api/infloww/*),
 * NOT to openapi.infloww.com directly. The real Infloww API key never
 * leaves the server; server-side calls go through src/lib/infloww/client.ts.
 *
 * Responsibilities:
 *   - Base URL so service functions only write the path.
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
  baseURL: "/api/infloww",
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
