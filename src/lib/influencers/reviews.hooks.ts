import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export interface InfluencerReview {
  _id: string;
  authorName: string;
  content: string;
  weekKey: string | null;
  rating: number | null;
  createdAt: string;
}

export interface CreateReviewBody {
  content: string;
  authorName?: string;
  weekKey?: string;
  rating?: number;
}

function reviewsKey(influencerId: string) {
  return ["influencer-reviews", influencerId] as const;
}

export function useReviews(
  influencerId: string | null,
  options?: { enabled?: boolean },
) {
  return useQuery<InfluencerReview[]>({
    queryKey: reviewsKey(influencerId ?? ""),
    queryFn: async () => {
      const { data } = await api.get<{ data: InfluencerReview[] }>(
        `/api/influencers/${influencerId}/reviews`,
      );
      return data.data;
    },
    enabled: !!influencerId && (options?.enabled ?? true),
  });
}

export function useCreateReview(influencerId: string) {
  const qc = useQueryClient();
  return useMutation<InfluencerReview, Error, CreateReviewBody>({
    mutationFn: async (body) => {
      const { data } = await api.post<{ data: InfluencerReview }>(
        `/api/influencers/${influencerId}/reviews`,
        body,
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reviewsKey(influencerId) });
    },
  });
}
