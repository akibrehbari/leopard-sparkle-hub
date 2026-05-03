import api from "@/lib/api";
import type {
  CreateInfluencerBody,
  Influencer,
  SyncResult,
  UpdateInfluencerBody,
} from "./types";

class InfluencersService {
  private static readonly BASE_PATH = "/api/influencers";

  private url(endpoint = "") {
    return `${InfluencersService.BASE_PATH}${endpoint}`;
  }

  async list(): Promise<Influencer[]> {
    const { data } = await api.get<{ data: Influencer[] }>(this.url());
    return data.data;
  }

  async get(id: string): Promise<Influencer> {
    const { data } = await api.get<{ data: Influencer }>(this.url(`/${id}`));
    return data.data;
  }

  async createManual(body: CreateInfluencerBody): Promise<Influencer> {
    const { data } = await api.post<{ data: Influencer }>(this.url(), body);
    return data.data;
  }

  async update(id: string, body: UpdateInfluencerBody): Promise<Influencer> {
    const { data } = await api.patch<{ data: Influencer }>(this.url(`/${id}`), body);
    return data.data;
  }

  async remove(id: string): Promise<void> {
    await api.delete(this.url(`/${id}`));
  }

  async sync(): Promise<SyncResult> {
    const { data } = await api.post<{ data: SyncResult }>(this.url("/sync"));
    return data.data;
  }
}

export const influencersService = new InfluencersService();
