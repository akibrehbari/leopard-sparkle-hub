import type { DailyPoint, ModelProfile } from "./types";

function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function generateHistory(seed: number, base: {
  followers: number;
  revenue: number;
  subs: number;
  reddit: number;
  twitter: number;
  instagram: number;
  telegram: number;
}): DailyPoint[] {
  const rng = seededRandom(seed);
  const days = 90;
  const today = new Date();
  const out: DailyPoint[] = [];

  let f = base.followers * 0.7;
  let rev = base.revenue * 0.6;
  let subs = base.subs * 0.7;
  let r = base.reddit * 0.7;
  let t = base.twitter * 0.7;
  let i = base.instagram * 0.7;
  let tg = base.telegram * 0.7;

  for (let d = days - 1; d >= 0; d--) {
    const date = new Date(today);
    date.setDate(today.getDate() - d);
    const drift = 1 + (rng() * 0.012 + 0.002);
    f *= drift;
    r *= 1 + (rng() * 0.014 + 0.001);
    t *= 1 + (rng() * 0.01 + 0.001);
    i *= 1 + (rng() * 0.018 + 0.002);
    tg *= 1 + (rng() * 0.011 + 0.001);
    rev *= 1 + (rng() * 0.02 - 0.003);
    subs *= 1 + (rng() * 0.015 - 0.002);

    const newSubs = Math.round(rng() * 60 + 20);
    const lostSubs = Math.round(rng() * 30 + 5);

    out.push({
      date: date.toISOString().slice(0, 10),
      totalFollowers: Math.round(r + t + i + tg),
      reddit: Math.round(r),
      twitter: Math.round(t),
      instagram: Math.round(i),
      telegram: Math.round(tg),
      revenue: Math.round(rev),
      subscribers: Math.round(subs),
      newSubs,
      lostSubs,
    });
  }
  return out;
}

export const MODELS: ModelProfile[] = [
  {
    id: "luna",
    stageName: "Luna Vega",
    actualName: "Sofia M.",
    profileImage: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=faces",
    status: "Active",
    reddit: { handle: "u/lunavega", subreddit: "r/LunaVega", karma: 184230, followers: 28500, subredditFollowers: 12400 },
    twitter: { handle: "@lunavega_x", followers: 41200 },
    instagram: [
      { handle: "@luna.vega", followers: 86400 },
      { handle: "@luna.daily", followers: 23100 },
    ],
    telegram: { channel: "Luna VIP", followers: 9800 },
    onlyFans: {
      totalRevenue: 48230,
      subscriptionRevenue: 22100,
      tipsRevenue: 11430,
      ppvRevenue: 14700,
      activeSubscribers: 3120,
      newSubscribers: 412,
      lostSubscribers: 138,
      conversionRate: 0.084,
      churnRate: 0.043,
      trafficClicks: 18420,
      engagementRate: 0.072,
    },
    platformEconomics: {
      reddit: { cost: 1800, revenue: 18320 },
      twitter: { cost: 1200, revenue: 8400 },
      instagram: { cost: 3400, revenue: 16100 },
      telegram: { cost: 600, revenue: 5410 },
    },
    subscriptionEconomics: {
      pricePerSub: 14.99,
      costPerSub: 17.0,
      revenuePerSub: 15.46,
      lifetimeValue: 96,
      paybackDays: 34,
    },
    notes: {
      weeklyReport:
        "Strong week — Reddit posts in r/gonewild drove 38% of OF clicks. Instagram @luna.vega gained 4.1k followers from a viral reel. Two PPV drops generated $4,200 combined.",
      upcomingPlan:
        "Launch a 7-day discounted sub campaign next Monday. Schedule 3 collab Reels and one Telegram-exclusive PPV. A/B test new Linktree layout.",
    },
    history: generateHistory(11, { followers: 139000, revenue: 1700, subs: 3120, reddit: 28500, twitter: 41200, instagram: 109500, telegram: 9800 }),
  },
  {
    id: "ivy",
    stageName: "Ivy Knox",
    actualName: "Hannah R.",
    profileImage: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&h=200&fit=crop&crop=faces",
    status: "Active",
    reddit: { handle: "u/ivyknox", subreddit: "r/IvyKnox", karma: 98420, followers: 17800, subredditFollowers: 7200 },
    twitter: { handle: "@ivyknox", followers: 22800 },
    instagram: [{ handle: "@ivy.knox", followers: 54200 }],
    telegram: { channel: "Ivy Inner Circle", followers: 4100 },
    onlyFans: {
      totalRevenue: 26840,
      subscriptionRevenue: 14200,
      tipsRevenue: 5840,
      ppvRevenue: 6800,
      activeSubscribers: 1840,
      newSubscribers: 198,
      lostSubscribers: 92,
      conversionRate: 0.061,
      churnRate: 0.05,
      trafficClicks: 9120,
      engagementRate: 0.058,
    },
    platformEconomics: {
      reddit: { cost: 1200, revenue: 9420 },
      twitter: { cost: 800, revenue: 4800 },
      instagram: { cost: 2200, revenue: 9600 },
      telegram: { cost: 300, revenue: 3020 },
    },
    subscriptionEconomics: {
      pricePerSub: 12.99,
      costPerSub: 22.7,
      revenuePerSub: 14.59,
      lifetimeValue: 72,
      paybackDays: 47,
    },
    notes: {
      weeklyReport:
        "Steady growth on IG (+1.8k). Reddit engagement softened mid-week; cadence dropped to 4 posts. PPV conversion remains below target.",
      upcomingPlan:
        "Increase Reddit posting cadence to 2/day. Test new PPV pricing tier ($12). Run cross-promo with Luna Vega.",
    },
    history: generateHistory(23, { followers: 98800, revenue: 950, subs: 1840, reddit: 17800, twitter: 22800, instagram: 54200, telegram: 4100 }),
  },
  {
    id: "aria",
    stageName: "Aria Storm",
    actualName: "Mia L.",
    profileImage: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=200&h=200&fit=crop&crop=faces",
    status: "Testing",
    reddit: { handle: "u/ariastorm", subreddit: "r/AriaStorm", karma: 22100, followers: 5200, subredditFollowers: 1800 },
    twitter: { handle: "@ariastorm", followers: 8400 },
    instagram: [
      { handle: "@aria.storm", followers: 14200 },
      { handle: "@aria.bts", followers: 3100 },
    ],
    telegram: { channel: "Aria Storm", followers: 1200 },
    onlyFans: {
      totalRevenue: 6420,
      subscriptionRevenue: 3100,
      tipsRevenue: 1420,
      ppvRevenue: 1900,
      activeSubscribers: 412,
      newSubscribers: 88,
      lostSubscribers: 22,
      conversionRate: 0.052,
      churnRate: 0.038,
      trafficClicks: 2840,
      engagementRate: 0.064,
    },
    platformEconomics: {
      reddit: { cost: 700, revenue: 2400 },
      twitter: { cost: 400, revenue: 1100 },
      instagram: { cost: 1100, revenue: 2200 },
      telegram: { cost: 150, revenue: 720 },
    },
    subscriptionEconomics: {
      pricePerSub: 9.99,
      costPerSub: 26.7,
      revenuePerSub: 15.58,
      lifetimeValue: 58,
      paybackDays: 62,
    },
    notes: {
      weeklyReport:
        "Testing phase — onboarding new content cadence. Initial Reddit traction promising; karma +6k this week.",
      upcomingPlan:
        "Move to Active status next week if conversion holds. Prepare welcome PPV bundle and pinned X thread.",
    },
    history: generateHistory(37, { followers: 32100, revenue: 220, subs: 412, reddit: 5200, twitter: 8400, instagram: 17300, telegram: 1200 }),
  },
  {
    id: "raven",
    stageName: "Raven Cole",
    actualName: "Elena K.",
    profileImage: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=200&h=200&fit=crop&crop=faces",
    status: "Active",
    reddit: { handle: "u/ravencole", subreddit: "r/RavenCole", karma: 312400, followers: 42100, subredditFollowers: 21800 },
    twitter: { handle: "@ravencole", followers: 68400 },
    instagram: [
      { handle: "@raven.cole", followers: 132000 },
      { handle: "@raven.vip", followers: 41200 },
      { handle: "@raven.fitness", followers: 18400 },
    ],
    telegram: { channel: "Raven Cole VIP", followers: 14200 },
    onlyFans: {
      totalRevenue: 78420,
      subscriptionRevenue: 38400,
      tipsRevenue: 18420,
      ppvRevenue: 21600,
      activeSubscribers: 5240,
      newSubscribers: 612,
      lostSubscribers: 184,
      conversionRate: 0.094,
      churnRate: 0.035,
      trafficClicks: 28400,
      engagementRate: 0.081,
    },
    platformEconomics: {
      reddit: { cost: 2400, revenue: 28100 },
      twitter: { cost: 1800, revenue: 14200 },
      instagram: { cost: 4800, revenue: 28200 },
      telegram: { cost: 900, revenue: 7920 },
    },
    subscriptionEconomics: {
      pricePerSub: 14.99,
      costPerSub: 16.2,
      revenuePerSub: 14.97,
      lifetimeValue: 128,
      paybackDays: 28,
    },
    notes: {
      weeklyReport:
        "Top performer this week — $11.4k revenue, conversion at 9.4%. Instagram @raven.cole drove most quality traffic. Tips up 22% w/w.",
      upcomingPlan:
        "Plan Q2 brand collab. Test premium tier subscription ($24.99). Schedule second Telegram drop.",
    },
    history: generateHistory(53, { followers: 316900, revenue: 2700, subs: 5240, reddit: 42100, twitter: 68400, instagram: 191600, telegram: 14200 }),
  },
  {
    id: "nova",
    stageName: "Nova Lane",
    actualName: "Priya S.",
    profileImage: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&h=200&fit=crop&crop=faces",
    status: "Inactive",
    reddit: { handle: "u/novalane", subreddit: "r/NovaLane", karma: 41200, followers: 8400, subredditFollowers: 3100 },
    twitter: { handle: "@novalane", followers: 12800 },
    instagram: [{ handle: "@nova.lane", followers: 21400 }],
    telegram: { channel: "Nova Lane", followers: 1800 },
    onlyFans: {
      totalRevenue: 3120,
      subscriptionRevenue: 1800,
      tipsRevenue: 620,
      ppvRevenue: 700,
      activeSubscribers: 320,
      newSubscribers: 12,
      lostSubscribers: 84,
      conversionRate: 0.028,
      churnRate: 0.21,
      trafficClicks: 1240,
      engagementRate: 0.029,
    },
    platformEconomics: {
      reddit: { cost: 400, revenue: 1100 },
      twitter: { cost: 300, revenue: 620 },
      instagram: { cost: 600, revenue: 980 },
      telegram: { cost: 100, revenue: 420 },
    },
    subscriptionEconomics: {
      pricePerSub: 9.99,
      costPerSub: 116.7,
      revenuePerSub: 9.75,
      lifetimeValue: 32,
      paybackDays: 0,
    },
    notes: {
      weeklyReport:
        "Account paused — model on break. Churn elevated due to inactive posting. No new PPV drops this week.",
      upcomingPlan:
        "Decision pending on relaunch. If resuming, schedule a 2-week ramp-up with daily Reddit and 3x IG/week.",
    },
    history: generateHistory(71, { followers: 44400, revenue: 110, subs: 320, reddit: 8400, twitter: 12800, instagram: 21400, telegram: 1800 }),
  },
];