import api from "@/lib/api";
import type { PlatformKey } from "@/lib/platforms/registry";
import type { ListEntriesParams, UpsertEntryBody, WeeklyEntry } from "./types";

class EntriesService {
  private static readonly BASE_PATH = "/api/entries";

  private url() {
    return EntriesService.BASE_PATH;
  }

  async list(params: ListEntriesParams = {}): Promise<WeeklyEntry[]> {
    const sp = new URLSearchParams();
    if (params.influencerId) sp.set("influencerId", params.influencerId);
    if (params.platform) sp.set("platform", params.platform);
    if (params.weekKeys?.length) sp.set("weekKeys", params.weekKeys.join(","));

    const { data } = await api.get<{ data: WeeklyEntry[] }>(
      `${this.url()}?${sp}`,
    );
    return data.data;
  }

  async upsert(body: UpsertEntryBody): Promise<WeeklyEntry> {
    const { data } = await api.put<{ data: WeeklyEntry }>(this.url(), body);
    return data.data;
  }

  async remove(params: {
    influencerId: string;
    platform: PlatformKey;
    weekKey: string;
  }): Promise<void> {
    const sp = new URLSearchParams(params);
    await api.delete(`${this.url()}?${sp}`);
  }
}

export const entriesService = new EntriesService();
