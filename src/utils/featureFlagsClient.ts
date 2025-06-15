
import { supabase } from '@/integrations/supabase/client';

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_EDGE_FUNCTION_URL || "https://kwnwhgucnzqxndzjayyq.supabase.co"}/functions/v1/get-feature-flags`;

export async function fetchFeatureFlags({ userId, tier }: { userId?: string; tier?: string }) {
  const url = new URL(EDGE_FUNCTION_URL);
  if (userId) url.searchParams.append("userId", userId);
  if (tier) url.searchParams.append("tier", tier);

  const res = await fetch(url.toString(), {
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error("Failed to fetch feature flags");
  const json = await res.json();
  return json.flags ?? [];
}
