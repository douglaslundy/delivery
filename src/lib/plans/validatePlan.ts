import { FEATURE_LABEL, type PlanFeature } from "@/lib/plans/labels";

const LIMITS = ["maxOrdersPerMonth", "maxProducts", "maxCustomers", "maxCategories", "maxMembers", "maxDeliveryPeople"] as const;

export type PlanInput = {
  name: string;
  description: string | null;
  priceCents: number;
  active: boolean;
  features: Record<PlanFeature, boolean>;
} & Record<(typeof LIMITS)[number], number | null>;

// Campo vazio/null = ilimitado. partial=true aceita só os campos enviados (PATCH).
export function validatePlan(body: Record<string, unknown>, partial = false): { data?: Partial<PlanInput>; error?: string } {
  const data: Record<string, unknown> = {};
  if (!partial || "name" in body) {
    if (typeof body.name !== "string" || !body.name.trim()) return { error: "name is required" };
    data.name = body.name.trim();
  }
  if ("description" in body) {
    data.description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
  }
  if (!partial || "priceCents" in body) {
    if (typeof body.priceCents !== "number" || !Number.isInteger(body.priceCents) || body.priceCents < 0) {
      return { error: "priceCents must be a non-negative integer" };
    }
    data.priceCents = body.priceCents;
  }
  if ("active" in body) {
    if (typeof body.active !== "boolean") return { error: "active must be a boolean" };
    data.active = body.active;
  }
  for (const field of LIMITS) {
    if (!(field in body)) continue;
    const v = body[field];
    if (v === null || v === "") data[field] = null;
    else if (typeof v === "number" && Number.isInteger(v) && v >= 0) data[field] = v;
    else return { error: `${field} must be a non-negative integer or empty` };
  }
  if (!partial || "features" in body) {
    const raw = (body.features ?? {}) as Record<string, unknown>;
    data.features = Object.fromEntries(Object.keys(FEATURE_LABEL).map((k) => [k, raw[k] === true]));
  }
  return { data: data as Partial<PlanInput> };
}
