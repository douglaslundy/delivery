import { describe, it, expect } from "vitest";
import { canJoinRoom } from "@/server/realtime";

describe("canJoinRoom", () => {
  it("allows joining a room for a store the session has access to", () => {
    expect(canJoinRoom("store:store-a:kds", ["store-a"])).toBe(true);
  });
  it("rejects joining a room for a store outside the session", () => {
    expect(canJoinRoom("store:store-b:kds", ["store-a"])).toBe(false);
  });
  it("rejects a malformed room name", () => {
    expect(canJoinRoom("not-a-room", ["store-a"])).toBe(false);
  });
});
