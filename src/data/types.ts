export type ModelStatus = "Active" | "Inactive" | "Testing";

export interface InstagramAccount {
  handle: string;
  followers: number;
}

export interface DailyPoint {
  date: string; // ISO yyyy-mm-dd
  totalFollowers: number;
  reddit: number;
  twitter: number;
  instagram: number;
  telegram: number;
  revenue: number;
  subscribers: number;
  newSubs: number;
  lostSubs: number;
}

export interface ModelProfile {
  id: string;
  stageName: string;
  actualName: string;
  profileImage: string;
  status: ModelStatus;
  reddit: {
    handle: string;
    subreddit: string;
    karma: number;
    followers: number;
    subredditFollowers: number;
  };
  twitter: {
    handle: string;
    followers: number;
  };
  instagram: InstagramAccount[];
  telegram: {
    channel: string;
    followers: number;
  };
  onlyFans: {
    totalRevenue: number;
    subscriptionRevenue: number;
    tipsRevenue: number;
    ppvRevenue: number;
    activeSubscribers: number;
    newSubscribers: number;
    lostSubscribers: number;
    conversionRate: number; // 0..1
    churnRate: number; // 0..1
    trafficClicks: number;
    engagementRate: number; // 0..1
  };
  /** Operational cost and attributed revenue per acquisition channel (period totals) */
  platformEconomics: {
    reddit: PlatformEcon;
    twitter: PlatformEcon;
    instagram: PlatformEcon;
    telegram: PlatformEcon;
  };
  /** Subscription economics — per-subscriber unit economics */
  subscriptionEconomics: {
    pricePerSub: number;        // average monthly price in $
    costPerSub: number;         // total acquisition + content cost / new subs ($)
    revenuePerSub: number;      // total revenue / active subs ($)
    lifetimeValue: number;      // estimated LTV ($)
    paybackDays: number;        // days to recover CAC
  };
  notes: {
    weeklyReport: string;
    upcomingPlan: string;
  };
  history: DailyPoint[];
}

export interface PlatformEcon {
  cost: number;     // operational cost ($) for the period
  revenue: number;  // attributed OF revenue ($) from this channel
}