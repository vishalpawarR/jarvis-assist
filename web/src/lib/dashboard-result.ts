import { redirect } from "next/navigation";

export function dashboardResult(feature: string, result: "saved" | "deleted" | "error"): never {
  redirect(`/dashboard?feature=${feature}&result=${result}`);
}
