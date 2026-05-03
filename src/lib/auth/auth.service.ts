/**
 * Browser-side auth service. Calls the /api/auth/* proxy routes.
 *
 * Knows nothing about React; consumed by auth.hooks.ts.
 */
import api from "@/lib/api";

export interface SessionUser {
  username: string;
}

export interface LoginParams {
  username: string;
  password: string;
}

class AuthService {
  private static readonly BASE_PATH = "/api/auth";

  private url(endpoint: string) {
    return `${AuthService.BASE_PATH}${endpoint}`;
  }

  async login(params: LoginParams): Promise<SessionUser> {
    const { data } = await api.post<{ user: SessionUser }>(
      this.url("/login"),
      params,
    );
    return data.user;
  }

  async logout(): Promise<void> {
    await api.post(this.url("/logout"));
  }

  /** Returns null when there is no active session. */
  async me(): Promise<SessionUser | null> {
    try {
      const { data } = await api.get<{ user: SessionUser | null }>(this.url("/me"));
      return data.user;
    } catch {
      return null;
    }
  }
}

export const authService = new AuthService();
