import { describe, it, expect } from "vitest";
import { encryptCredential, decryptCredential } from "@/lib/crypto";

describe("credential encryption", () => {
  it("round-trips a plaintext string", () => {
    const original = "evolution-api-key-abc123";
    const encrypted = encryptCredential(original);
    expect(encrypted).not.toBe(original);
    expect(decryptCredential(encrypted)).toBe(original);
  });

  it("round-trips an empty string", () => {
    const encrypted = encryptCredential("");
    expect(decryptCredential(encrypted)).toBe("");
  });

  it("round-trips unicode content", () => {
    const original = "chave-çãú-123";
    expect(decryptCredential(encryptCredential(original))).toBe(original);
  });
});
