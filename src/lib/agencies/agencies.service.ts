import api from "@/lib/api";
import type {
  Agency,
  AgencySummary,
  CreateAgencyBody,
  UpdateAgencyBody,
} from "./types";

class AgenciesService {
  private static readonly BASE_PATH = "/api/agencies";

  private url(endpoint = "") {
    return `${AgenciesService.BASE_PATH}${endpoint}`;
  }

  async list(): Promise<Agency[]> {
    const { data } = await api.get<{ data: Agency[] }>(this.url());
    return data.data;
  }

  /**
   * Lightweight list for the active-agency switcher dropdown. Returns just
   * `_id` + `name` (no counts, no joins) so the topbar renders fast.
   */
  async listSummaries(): Promise<AgencySummary[]> {
    const { data } = await api.get<{ data: AgencySummary[] }>(
      this.url("/summaries"),
    );
    return data.data;
  }

  async create(body: CreateAgencyBody): Promise<Agency> {
    const { data } = await api.post<{ data: Agency }>(this.url(), body);
    return data.data;
  }

  async update(id: string, body: UpdateAgencyBody): Promise<Agency> {
    const { data } = await api.patch<{ data: Agency }>(
      this.url(`/${id}`),
      body,
    );
    return data.data;
  }

  async remove(id: string, confirmName: string): Promise<void> {
    await api.delete(this.url(`/${id}`), {
      data: { confirmName },
    });
  }

  /**
   * Set the active agency on the server (writes the cookie). The server
   * validates that `agencyId` exists. After this resolves, callers should
   * invalidate any tenant-scoped TanStack queries.
   */
  async setActive(agencyId: string): Promise<void> {
    await api.post(this.url("/active"), { agencyId });
  }

  /**
   * Fetch the full agency record for whichever agency is currently
   * active for the session (cookie for admin/editor, JWT for owner).
   * Returns `null` when no agency is selected yet.
   */
  async getActive(): Promise<Agency | null> {
    const { data } = await api.get<{ data: Agency | null }>(this.url("/active"));
    return data.data;
  }
}

export const agenciesService = new AgenciesService();
