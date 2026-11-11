"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthenticatedClient } from "@/features/shared/authenticated-client";
import { dashboardResult } from "@/lib/dashboard-result";

const detailSchema = z.object({
  fullName: z.string().trim().max(200).default(""),
  email: z.email().max(254).or(z.literal("")),
  phone: z.string().trim().max(80).default(""),
  location: z.string().trim().max(200).default(""),
  linkedin: z.url().max(2048).or(z.literal("")),
  customFields: z
    .array(
      z.object({
        id: z.string().uuid(),
        label: z.string().trim().min(1).max(100),
        value: z.string().trim().min(1).max(1000),
      }),
    )
    .max(30),
});

export async function savePersonalDetails(formData: FormData) {
  let customFields: unknown;
  try {
    customFields = JSON.parse(String(formData.get("customFields") || "[]"));
  } catch {
    dashboardResult("details", "error");
  }
  const parsedFields = z
    .array(z.object({ id: z.string(), label: z.string(), value: z.string() }))
    .safeParse(customFields);
  if (!parsedFields.success) dashboardResult("details", "error");
  customFields = parsedFields.data.filter((field) => field.label.trim() || field.value.trim());

  const parsed = detailSchema.safeParse({
    fullName: formData.get("fullName") || "",
    email: formData.get("email") || "",
    phone: formData.get("phone") || "",
    location: formData.get("location") || "",
    linkedin: formData.get("linkedin") || "",
    customFields,
  });
  if (!parsed.success) dashboardResult("details", "error");

  const { supabase, user } = await getAuthenticatedClient();
  const { error } = await supabase.from("personal_details").upsert(
    {
      user_id: user.id,
      details: parsed.data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    console.error("Jarvis could not save personal details.", error);
    dashboardResult("details", "error");
  }
  revalidatePath("/dashboard");
  dashboardResult("details", "saved");
}
