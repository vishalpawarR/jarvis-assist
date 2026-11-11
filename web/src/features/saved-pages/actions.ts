"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthenticatedClient } from "@/features/shared/authenticated-client";
import { dashboardResult } from "@/lib/dashboard-result";

const pageSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  title: z.string().trim().min(1).max(300),
  url: z.url().max(2048),
  selectedText: z.string().trim().max(5000).optional(),
  collection: z.enum(["read_later", "keep_forever"]),
});

export async function savePage(formData: FormData) {
  const parsed = pageSchema.safeParse({
    id: formData.get("id") || "",
    title: formData.get("title"),
    url: formData.get("url"),
    selectedText: formData.get("selectedText") || "",
    collection: formData.get("collection"),
  });
  if (!parsed.success) dashboardResult("pages", "error");
  const url = new URL(parsed.data.url);
  if (!["http:", "https:"].includes(url.protocol)) dashboardResult("pages", "error");

  const { supabase, user } = await getAuthenticatedClient();
  const record = {
    title: parsed.data.title,
    url: url.toString(),
    selected_text: parsed.data.selectedText || null,
    collection: parsed.data.collection,
    expires_at:
      parsed.data.collection === "read_later"
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : null,
    updated_at: new Date().toISOString(),
  };
  const result = parsed.data.id
    ? await supabase
        .from("saved_pages")
        .update(record)
        .eq("id", parsed.data.id)
        .eq("user_id", user.id)
    : await supabase.from("saved_pages").insert({ ...record, user_id: user.id });

  if (result.error) {
    console.error("Jarvis could not save a page.", result.error);
    dashboardResult("pages", "error");
  }
  revalidatePath("/dashboard");
  dashboardResult("pages", "saved");
}

export async function deletePage(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) dashboardResult("pages", "error");
  const { supabase, user } = await getAuthenticatedClient();
  const { error } = await supabase
    .from("saved_pages")
    .delete()
    .eq("id", id.data)
    .eq("user_id", user.id);
  if (error) {
    console.error("Jarvis could not delete a saved page.", error);
    dashboardResult("pages", "error");
  }
  revalidatePath("/dashboard");
  dashboardResult("pages", "deleted");
}
