import api from "@/lib/api";
import type {
  CreateSubredditBody,
  Subreddit,
  SubredditSnapshot,
  SubredditWithLatest,
  UpdateSubredditBody,
  UpsertSubredditSnapshotBody,
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

  async upsertSnapshot(body: UpsertSubredditSnapshotBody): Promise<SubredditSnapshot> {
    const { data } = await api.patch<{ data: SubredditSnapshot }>(
      this.url("/snapshots"),
      body,
    );
    return data.data;
  }

  async listSnapshots(weekKeys: string[]): Promise<SubredditSnapshot[]> {
    const { data } = await api.get<{ data: SubredditSnapshot[] }>(
      this.url(`/snapshots?weekKeys=${weekKeys.join(",")}`),
    );
    return data.data;
  }
}

export const subredditsService = new SubredditsService();
