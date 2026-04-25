import type { ModelProfile } from "@/data/types";
import { formatNumber } from "@/data/selectors";
import { Instagram, Send } from "lucide-react";

interface Props {
  model: ModelProfile;
}

function PlatformHeader({
  name,
  handle,
  color,
  icon,
}: {
  name: string;
  handle: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div
        className="size-8 rounded-lg grid place-items-center"
        style={{ background: `${color}20`, color }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-foreground">{name}</div>
        <div className="text-[11px] text-muted-foreground truncate">{handle}</div>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground tabular-nums">{value}</span>
    </div>
  );
}

const RedditIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
    <path d="M22 12.06c0-1.21-.98-2.19-2.19-2.19-.6 0-1.13.24-1.53.62-1.5-1.06-3.55-1.74-5.83-1.81l1.18-3.71 3.18.71c.04.96.84 1.74 1.81 1.74 1 0 1.81-.81 1.81-1.81S19.62 3.79 18.62 3.79c-.71 0-1.32.41-1.61 1l-3.55-.79c-.21-.04-.42.07-.5.27l-1.32 4.13c-2.32.07-4.4.74-5.94 1.81-.4-.39-.93-.62-1.52-.62C2.97 9.87 2 10.85 2 12.06c0 .89.53 1.65 1.29 1.99-.04.21-.06.42-.06.64 0 3.21 3.74 5.81 8.35 5.81s8.35-2.6 8.35-5.81c0-.21-.02-.43-.06-.64.76-.34 1.29-1.1 1.29-1.99zM7 13.31c0-.71.58-1.29 1.29-1.29.71 0 1.29.58 1.29 1.29s-.58 1.29-1.29 1.29c-.71 0-1.29-.58-1.29-1.29zm8.34 3.69c-.91.91-2.65 1-3.34 1s-2.43-.09-3.34-1c-.13-.13-.13-.35 0-.49.13-.13.35-.13.49 0 .58.58 1.81.78 2.85.78s2.27-.21 2.85-.78c.13-.13.35-.13.49 0 .14.14.14.36 0 .49zm-.27-2.4c-.71 0-1.29-.58-1.29-1.29s.58-1.29 1.29-1.29c.71 0 1.29.58 1.29 1.29s-.58 1.29-1.29 1.29z" />
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export function PlatformBreakdown({ model }: Props) {
  const igTotal = model.instagram.reduce((s, a) => s + a.followers, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* Reddit */}
      <div className="card-surface rounded-xl p-5">
        <PlatformHeader
          name="Reddit"
          handle={model.reddit.handle}
          color="hsl(var(--reddit))"
          icon={<RedditIcon />}
        />
        <StatRow label="Karma" value={formatNumber(model.reddit.karma)} />
        <StatRow label="Followers" value={formatNumber(model.reddit.followers)} />
        <StatRow label="Subreddit" value={model.reddit.subreddit} />
        <StatRow label="Subreddit followers" value={formatNumber(model.reddit.subredditFollowers)} />
      </div>

      {/* X */}
      <div className="card-surface rounded-xl p-5">
        <PlatformHeader
          name="X (Twitter)"
          handle={model.twitter.handle}
          color="hsl(var(--twitter))"
          icon={<XIcon />}
        />
        <StatRow label="Followers" value={formatNumber(model.twitter.followers)} />
        <div className="mt-2 text-[11px] text-muted-foreground">
          Primary distribution channel for link drops.
        </div>
      </div>

      {/* Instagram */}
      <div className="card-surface rounded-xl p-5">
        <PlatformHeader
          name="Instagram"
          handle={`${model.instagram.length} account${model.instagram.length === 1 ? "" : "s"}`}
          color="hsl(var(--instagram))"
          icon={<Instagram className="size-4" />}
        />
        <StatRow label="Combined followers" value={formatNumber(igTotal)} />
        <div className="mt-3 space-y-1.5 max-h-32 overflow-y-auto scrollbar-thin pr-1">
          {model.instagram.map((a) => (
            <div key={a.handle} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground truncate">{a.handle}</span>
              <span className="font-medium text-foreground tabular-nums shrink-0 ml-2">
                {formatNumber(a.followers)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Telegram */}
      <div className="card-surface rounded-xl p-5">
        <PlatformHeader
          name="Telegram"
          handle={model.telegram.channel}
          color="hsl(var(--telegram))"
          icon={<Send className="size-4" />}
        />
        <StatRow label="Channel followers" value={formatNumber(model.telegram.followers)} />
        <div className="mt-2 text-[11px] text-muted-foreground">
          VIP channel — exclusive PPV drops.
        </div>
      </div>
    </div>
  );
}