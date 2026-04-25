import { useMemo, useState } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Topbar } from "@/components/dashboard/Topbar";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { ModelOverview } from "@/components/dashboard/ModelOverview";
import { PlatformBreakdown } from "@/components/dashboard/PlatformBreakdown";
import { OnlyFansSection } from "@/components/dashboard/OnlyFansSection";
import { ReportsSection } from "@/components/dashboard/ReportsSection";
import { PlatformEconomicsSection } from "@/components/dashboard/PlatformEconomicsSection";
import { SubscriptionEconomicsSection } from "@/components/dashboard/SubscriptionEconomicsSection";
import { FollowersChart } from "@/components/dashboard/charts/FollowersChart";
import { PlatformChart } from "@/components/dashboard/charts/PlatformChart";
import { RevenueChart } from "@/components/dashboard/charts/RevenueChart";
import { SubscriberChart } from "@/components/dashboard/charts/SubscriberChart";
import { MODELS } from "@/data/mockModels";
import {
  aggregateModel,
  formatCurrency,
  formatNumber,
  growthPct,
  modelTotalFollowers,
  sliceHistory,
  type DateRange,
} from "@/data/selectors";
import {
  DollarSign,
  Percent,
  TrendingUp,
  Users,
  UserCheck,
} from "lucide-react";

const Index = () => {
  const [selectedId, setSelectedId] = useState<string>("all");
  const [range, setRange] = useState<DateRange>(  "30d");

  const aggregate = useMemo(() => aggregateModel(MODELS), []);
  const model = selectedId === "all" ? aggregate : MODELS.find((m) => m.id === selectedId) ?? aggregate;

  const slice = sliceHistory(model.history, range);
  const followerGrowth = growthPct(slice, "totalFollowers");
  const revenueGrowth = growthPct(slice, "revenue");
  const subsGrowth = growthPct(slice, "subscribers");

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar selectedId={selectedId} onSelect={setSelectedId} />

      <main className="flex-1 min-w-0">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 animate-fade-in">
          {/* Mobile model picker */}
          <div className="lg:hidden mb-4 flex items-center gap-2 overflow-x-auto scrollbar-thin pb-2">
            <button
              onClick={() => setSelectedId("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border ${
                selectedId === "all"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary/50 text-muted-foreground border-border"
              }`}
            >
              All Models
            </button>
            {MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border ${
                  selectedId === m.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary/50 text-muted-foreground border-border"
                }`}
              >
                {m.stageName}
              </button>
            ))}
          </div>

          <Topbar
            title={selectedId === "all" ? "All Models Overview" : model.stageName}
            subtitle={
              selectedId === "all"
                ? `Aggregated performance across ${MODELS.length} operations`
                : `${model.actualName} · ${model.status}`
            }
            range={range}
            onRangeChange={setRange}
          />

          {/* Model header */}
          <div className="mb-6">
            <ModelOverview model={model} />
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
            <KpiCard
              label="Total Followers"
              value={formatNumber(modelTotalFollowers(model))}
              delta={followerGrowth}
              icon={Users}
              accent="primary"
            />
            <KpiCard
              label="Follower Growth"
              value={`${followerGrowth >= 0 ? "+" : ""}${followerGrowth.toFixed(1)}%`}
              icon={TrendingUp}
              accent="success"
              hint={`Last ${range}`}
            />
            <KpiCard
              label="Total Revenue"
              value={formatCurrency(model.onlyFans.totalRevenue)}
              delta={revenueGrowth}
              icon={DollarSign}
              accent="success"
            />
            <KpiCard
              label="Active Subscribers"
              value={formatNumber(model.onlyFans.activeSubscribers)}
              delta={subsGrowth}
              icon={UserCheck}
              accent="info"
            />
            <KpiCard
              label="Conversion Rate"
              value={`${(model.onlyFans.conversionRate * 100).toFixed(1)}%`}
              icon={Percent}
              accent="instagram"
              hint={`Churn ${(model.onlyFans.churnRate * 100).toFixed(1)}%`}
            />
          </div>

          {/* Time-based graphs */}
          <section className="mb-6">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <ChartCard
                title="Follower Growth"
                subtitle="Total audience trend"
                className="xl:col-span-2"
              >
                <FollowersChart data={slice} />
              </ChartCard>
              <ChartCard title="Revenue" subtitle="Daily OnlyFans revenue">
                <RevenueChart data={slice} />
              </ChartCard>
            </div>
          </section>

          <section className="mb-6">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <ChartCard
                title="Per-Platform Followers"
                subtitle="Reddit · X · Instagram · Telegram"
                className="xl:col-span-2"
              >
                <PlatformChart data={slice} />
              </ChartCard>
              <ChartCard title="Subscriber Growth" subtitle="Active subscribers over time">
                <SubscriberChart data={slice} />
              </ChartCard>
            </div>
          </section>

          {/* Platform breakdown */}
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wider text-muted-foreground">
              Platform Breakdown
            </h2>
            <PlatformBreakdown model={model} />
          </section>

          {/* OnlyFans section */}
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
              OnlyFans Performance
            </h2>
            <OnlyFansSection model={model} range={range} />
          </section>

          {/* Platform economics */}
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
              Cost & Revenue per Platform
            </h2>
            <PlatformEconomicsSection model={model} />
          </section>

          {/* Subscription economics */}
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
              Subscription Economics
            </h2>
            <SubscriptionEconomicsSection model={model} />
          </section>

          {/* Reports */}
          <section className="mb-6">
            <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
              Reports & Plan
            </h2>
            <ReportsSection model={model} />
          </section>

          <footer className="text-center text-xs text-muted-foreground pt-4 pb-2">
            eLeopards Clients Dashboard · Internal use only
          </footer>
        </div>
      </main>
    </div>
  );
};

export default Index;
