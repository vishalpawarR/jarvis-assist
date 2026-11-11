"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthenticatedClient } from "@/features/shared/authenticated-client";
import { dashboardResult } from "@/lib/dashboard-result";

const siteSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  label: z.string().trim().min(1).max(100),
  url: z.url().max(2048),
});

export async function saveTrackedSite(formData: FormData) {
  const parsed = siteSchema.safeParse({
    id: formData.get("id") || "",
    label: formData.get("label"),
    url: formData.get("url"),
  });
  if (!parsed.success) dashboardResult("sites", "error");
  const url = new URL(parsed.data.url);
  if (!["http:", "https:"].includes(url.protocol)) dashboardResult("sites", "error");

  const { supabase, user } = await getAuthenticatedClient();
  const record = {
    label: parsed.data.label,
    url: url.toString(),
    hostname: url.hostname,
    favicon_url: `${url.origin}/favicon.ico`,
    updated_at: new Date().toISOString(),
  };
  const result = parsed.data.id
    ? await supabase
        .from("tracked_sites")
        .update(record)
        .eq("id", parsed.data.id)
        .eq("user_id", user.id)
        .is("deleted_at", null)
    : await supabase.from("tracked_sites").insert({ ...record, user_id: user.id });

  if (result.error) {
    console.error("Jarvis could not save a tracked website.", result.error);
    dashboardResult("sites", "error");
  }
  revalidatePath("/dashboard");
  dashboardResult("sites", "saved");
}

export async function deleteTrackedSite(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) dashboardResult("sites", "error");
  const { supabase, user } = await getAuthenticatedClient();
  const { error } = await supabase
    .from("tracked_sites")
    .delete()
    .eq("id", id.data)
    .eq("user_id", user.id);
  if (error) {
    console.error("Jarvis could not delete a tracked website.", error);
    dashboardResult("sites", "error");
  }
  revalidatePath("/dashboard");
  dashboardResult("sites", "deleted");
}
