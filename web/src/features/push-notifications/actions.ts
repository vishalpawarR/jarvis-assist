"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthenticatedClient } from "@/features/shared/authenticated-client";

const subscriptionSchema = z.object({
  endpoint: z.url().max(2048),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{1,256}$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{1,256}$/),
  }),
  dailyCheckinTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  timezone: z.string().trim().min(1).max(100),
});

function isValidTimeZone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch (error) {
    if (error instanceof RangeError) return false;
    throw error;
  }
}

function isSupportedPushEndpoint(endpoint: URL) {
  const hostname = endpoint.hostname.toLowerCase();
  return (
    hostname === "fcm.googleapis.com" ||
    hostname === "web.push.apple.com" ||
    hostname === "push.services.mozilla.com" ||
    hostname.endsWith(".push.services.mozilla.com") ||
    hostname === "notify.windows.com" ||
    hostname.endsWith(".notify.windows.com")
  );
}

export async function savePushSubscription(input: unknown) {
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { error: "The notification settings are invalid." };

  const endpoint = new URL(parsed.data.endpoint);
  if (
    endpoint.protocol !== "https:" ||
    !isSupportedPushEndpoint(endpoint) ||
    !isValidTimeZone(parsed.data.timezone)
  ) {
    return { error: "The push endpoint or time zone is invalid." };
  }

  const { supabase, user } = await getAuthenticatedClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: endpoint.toString(),
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      daily_checkins_enabled: true,
      daily_checkin_time: parsed.data.dailyCheckinTime,
      timezone: parsed.data.timezone,
    },
    { onConflict: "endpoint" },
  );
  if (error) {
    console.error("Jarvis could not save the push subscription.", error);
    return { error: "Could not save notification settings. Please try again." };
  }

  revalidatePath("/dashboard");
  return { error: null };
}

export async function getPushSchedule(input: unknown) {
  const parsed = z.object({ endpoint: z.url().max(2048) }).safeParse(input);
  if (!parsed.success) return { error: "The push subscription is invalid.", schedule: null };

  const endpoint = new URL(parsed.data.endpoint);
  if (endpoint.protocol !== "https:") {
    return { error: "The push endpoint is invalid.", schedule: null };
  }

  const { supabase, user } = await getAuthenticatedClient();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("daily_checkin_time, timezone")
    .eq("endpoint", endpoint.toString())
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("Jarvis could not load the push schedule.", error);
    return { error: "Could not load notification settings.", schedule: null };
  }

  return {
    error: null,
    schedule: data
      ? { dailyCheckinTime: data.daily_checkin_time.slice(0, 5), timezone: data.timezone }
      : null,
  };
}

export async function removePushSubscription(input: unknown) {
  const parsed = z.object({ endpoint: z.url().max(2048) }).safeParse(input);
  if (!parsed.success) return { error: "The push subscription is invalid." };

  const endpoint = new URL(parsed.data.endpoint);
  if (endpoint.protocol !== "https:") return { error: "The push endpoint is invalid." };

  const { supabase, user } = await getAuthenticatedClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint.toString())
    .eq("user_id", user.id);
  if (error) {
    console.error("Jarvis could not remove the push subscription.", error);
    return { error: "Could not turn off notifications. Please try again." };
  }

  revalidatePath("/dashboard");
  return { error: null };
}
