import api from "@/lib/api";
import type {
  CreateSubredditBody,
  Subreddit,
  SubredditWithLatest,
  SyncResult,
  UpdateSubredditBody,
} from "./types";

class SubredditsService {
  private static readonly BASE_PATH = "/api/subreddits";

  private url(endpoint = "") {
    return `${SubredditsService.BASE_PATH}${endpoint}`;
  }

  async list(): Promise<SubredditWithLatest[]> {
    const { data } = await api.get<{ data: SubredditWithLatest[] }>(this.url());
    return data.data;
  }

  async get(id: string): Promise<Subreddit> {
    const { data } = await api.get<{ data: Subreddit }>(this.url(`/${id}`));
    return data.data;
  }

  async create(body: CreateSubredditBody): Promise<Subreddit> {
    const { data } = await api.post<{ data: Subreddit }>(this.url(), body);
    return data.data;
  }

  async update(id: string, body: UpdateSubredditBody): Promise<Subreddit> {
    const { data } = await api.patch<{ data: Subreddit }>(this.url(`/${id}`), body);
    return data.data;
  }

  async remove(id: string): Promise<void> {
    await api.delete(this.url(`/${id}`));
  }

  async syncAll(): Promise<SyncResult> {
    const { data } = await api.post<{ data: SyncResult }>(this.url("/sync"));
    return data.data;
  }

  async syncOne(id: string): Promise<SyncResult> {
    const { data } = await api.post<{ data: SyncResult }>(this.url(`/sync/${id}`));
    return data.data;
  }
}

export const subredditsService = new SubredditsService();
