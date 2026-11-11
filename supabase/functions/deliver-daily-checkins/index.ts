import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import webPush from "web-push";

type PushSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  send_for_date: string;
};

type PushDatabase = {
  public: {
    Tables: {
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          daily_checkins_enabled: boolean;
          daily_checkin_time: string;
          timezone: string;
          last_sent_local_date: string | null;
          claimed_until: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      claim_due_push_subscriptions: {
        Args: { p_limit?: number };
        Returns: PushSubscription[];
      };
      complete_push_delivery: {
        Args: { p_subscription_id: string; p_send_for_date: string };
        Returns: boolean;
      };
      defer_push_delivery_claim: {
        Args: { p_subscription_id: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function readEnvironment() {
  const names = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "PUSH_CRON_SECRET",
    "VAPID_PUBLIC_KEY",
    "VAPID_PRIVATE_KEY",
    "VAPID_SUBJECT",
  ] as const;
  const values = Object.fromEntries(
    names.map((name) => [name, Deno.env.get(name)]),
  );
  const missing = names.filter((name) => !values[name]);
  return { values, missing };
}

function matchesSecret(received: string, expected: string) {
  const encoder = new TextEncoder();
  const actualBytes = encoder.encode(received);
  const expectedBytes = encoder.encode(expected);
  if (actualBytes.length !== expectedBytes.length) return false;

  let difference = 0;
  for (let index = 0; index < actualBytes.length; index += 1) {
    difference |= actualBytes[index] ^ expectedBytes[index];
  }
  return difference === 0;
}

function readStatusCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode;
  }
  return null;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown push delivery error";
}

function errorName(error: unknown) {
  return error instanceof Error ? error.name : "Unknown";
}

function isPushSubscription(value: unknown): value is PushSubscription {
  if (typeof value !== "object" || value === null) return false;
  return (
    "id" in value &&
    typeof value.id === "string" &&
    "endpoint" in value &&
    typeof value.endpoint === "string" &&
    "p256dh" in value &&
    typeof value.p256dh === "string" &&
    "auth" in value &&
    typeof value.auth === "string" &&
    "send_for_date" in value &&
    typeof value.send_for_date === "string"
  );
}

function isSupportedPushEndpoint(endpoint: string) {
  let hostname: string;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return false;
    hostname = url.hostname.toLowerCase();
  } catch (error) {
    if (error instanceof TypeError) return false;
    throw error;
  }

  return (
    hostname === "fcm.googleapis.com" ||
    hostname === "web.push.apple.com" ||
    hostname === "push.services.mozilla.com" ||
    hostname.endsWith(".push.services.mozilla.com") ||
    hostname === "notify.windows.com" ||
    hostname.endsWith(".notify.windows.com")
  );
}

async function deferPushClaim(
  supabase: SupabaseClient<PushDatabase>,
  subscriptionId: string,
) {
  try {
    const { error } = await supabase.rpc("defer_push_delivery_claim", {
      p_subscription_id: subscriptionId,
    });
    if (error) {
      console.error("Jarvis could not defer a failed push delivery retry.", {
        subscriptionId,
        error,
      });
    }
  } catch (error) {
    console.error("Jarvis could not defer a failed push delivery retry.", {
      subscriptionId,
      error: errorMessage(error),
    });
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const { values, missing } = readEnvironment();
  if (missing.length > 0) {
    console.error(
      "Daily push delivery is missing required environment variables.",
      missing,
    );
    return jsonResponse({ error: "Push delivery is not configured." }, 500);
  }

  const cronSecret = values.PUSH_CRON_SECRET!;
  if (cronSecret.length < 32) {
    console.error("PUSH_CRON_SECRET must be at least 32 characters.");
    return jsonResponse({ error: "Push delivery is not configured." }, 500);
  }
  if (!matchesSecret(request.headers.get("x-cron-secret") ?? "", cronSecret)) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  try {
    webPush.setVapidDetails(
      values.VAPID_SUBJECT!,
      values.VAPID_PUBLIC_KEY!,
      values.VAPID_PRIVATE_KEY!,
    );
  } catch (error) {
    console.error(
      "Daily push delivery has invalid VAPID configuration.",
      error,
    );
    return jsonResponse({ error: "Push delivery is not configured." }, 500);
  }

  const supabase = createClient<PushDatabase>(
    values.SUPABASE_URL!,
    values.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
  let subscriptions: unknown;
  try {
    const result = await supabase.rpc("claim_due_push_subscriptions", {
      p_limit: 100,
    });
    if (result.error) {
      console.error(
        "Jarvis could not claim due push notifications.",
        result.error,
      );
      return jsonResponse({ error: "Could not load due notifications." }, 500);
    }
    subscriptions = result.data;
  } catch (error) {
    console.error(
      "Jarvis could not claim due push notifications.",
      errorMessage(error),
    );
    return jsonResponse({ error: "Could not load due notifications." }, 500);
  }

  if (!Array.isArray(subscriptions)) {
    console.error("Jarvis received an invalid push subscription batch.");
    return jsonResponse({ error: "Could not load due notifications." }, 500);
  }
  const rows: unknown[] = subscriptions;
  const dueSubscriptions: PushSubscription[] = [];
  for (const row of rows) {
    if (!isPushSubscription(row)) {
      console.error("Jarvis received an invalid push subscription row.");
      return jsonResponse({ error: "Could not load due notifications." }, 500);
    }
    dueSubscriptions.push(row);
  }

  const outcomes = await Promise.all(
    dueSubscriptions.map(async (subscription) => {
      if (!isSupportedPushEndpoint(subscription.endpoint)) {
        console.error("Jarvis skipped an unsupported push endpoint.", {
          subscriptionId: subscription.id,
        });
        await deferPushClaim(supabase, subscription.id);
        return "failed";
      }

      try {
        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify({
            title: "Your Jarvis job-search check-in",
            body: "Take a moment to review your job-search progress.",
            url: "/dashboard",
          }),
          { TTL: 3600, urgency: "normal" },
        );
      } catch (error) {
        const statusCode = readStatusCode(error);
        if (statusCode === 404 || statusCode === 410) {
          try {
            const { error: deleteError } = await supabase
              .from("push_subscriptions")
              .delete()
              .eq("id", subscription.id);
            if (deleteError) {
              console.error(
                "Jarvis could not remove an expired push subscription.",
                {
                  subscriptionId: subscription.id,
                  error: deleteError,
                },
              );
            } else {
              return "expired";
            }
          } catch (deleteError) {
            console.error(
              "Jarvis could not remove an expired push subscription.",
              {
                subscriptionId: subscription.id,
                error: errorMessage(deleteError),
              },
            );
          }
        } else {
          console.error("Jarvis could not deliver a daily push notification.", {
            subscriptionId: subscription.id,
            statusCode,
            errorName: errorName(error),
          });
        }
        await deferPushClaim(supabase, subscription.id);
        return "failed";
      }

      try {
        const { data: completed, error: completeError } = await supabase.rpc(
          "complete_push_delivery",
          {
            p_subscription_id: subscription.id,
            p_send_for_date: subscription.send_for_date,
          },
        );
        if (completeError || !completed) {
          console.error("Jarvis could not record a completed push delivery.", {
            subscriptionId: subscription.id,
            error: completeError,
          });
          return "failed";
        }
      } catch (completeError) {
        console.error("Jarvis could not record a completed push delivery.", {
          subscriptionId: subscription.id,
          error: errorMessage(completeError),
        });
        return "failed";
      }
      return "sent";
    }),
  );

  return jsonResponse({
    claimed: outcomes.length,
    sent: outcomes.filter((outcome) => outcome === "sent").length,
    expired: outcomes.filter((outcome) => outcome === "expired").length,
    failed: outcomes.filter((outcome) => outcome === "failed").length,
  });
});
