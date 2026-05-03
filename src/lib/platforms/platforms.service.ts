import api from "@/lib/api";
import type { PlatformDefinition, PlatformKey } from "./registry";

class PlatformsService {
  private static readonly BASE_PATH = "/api/platforms";

  async list(): Promise<Record<PlatformKey, PlatformDefinition>> {
    const { data } = await api.get<{ data: Record<PlatformKey, PlatformDefinition> }>(
      PlatformsService.BASE_PATH,
    );
    return data.data;
  }
}

export const platformsService = new PlatformsService();
