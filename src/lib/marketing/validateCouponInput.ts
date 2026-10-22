export function validateCouponInput(body: Record<string, unknown>, isCreate: boolean, existingKind?: string): string | null {
  if (isCreate && (typeof body.code !== "string" || body.code.trim() === "")) {
    return "code is required";
  }

  const kindGiven = "kind" in body;
  if (isCreate && !kindGiven) {
    return "kind must be PERCENT or FIXED";
  }
  if (kindGiven && body.kind !== "PERCENT" && body.kind !== "FIXED") {
    return "kind must be PERCENT or FIXED";
  }

  const valueGiven = "value" in body;
  if (isCreate && !valueGiven) {
    return "value must be a positive integer";
  }
  if (valueGiven) {
    if (typeof body.value !== "number" || !Number.isInteger(body.value) || body.value <= 0) {
      return "value must be a positive integer";
    }
    const kind = (body.kind as string | undefined) ?? existingKind;
    if (kind === "PERCENT" && body.value > 100) {
      return "a PERCENT coupon's value cannot exceed 100";
    }
  }

  return null;
}
