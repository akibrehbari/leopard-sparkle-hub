"use client";

import { useSession } from "@/lib/auth/auth.hooks";
import { isManager } from "@/lib/auth/roles";
import { AddInfluencerDialog } from "@/components/influencers/AddInfluencerDialog";
import { AddWorkerDialog } from "@/components/workers/AddWorkerDialog";

/**
 * "Add influencer" and "Add worker" shortcut buttons shown in the dashboard
 * topbar for admin and agency_owner roles.
 */
export function QuickAddButtons() {
  const { data: session } = useSession();
  if (!isManager(session?.role)) return null;

  return (
    <div className="hidden md:flex items-center gap-2">
      <AddInfluencerDialog />
      <AddWorkerDialog />
    </div>
  );
}
