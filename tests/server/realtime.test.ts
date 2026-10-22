import { describe, it, expect } from "vitest";
import { canJoinRoom, parseCookieHeader } from "@/server/realtime";

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

describe("parseCookieHeader", () => {
  it("parses a raw Cookie header into a name/value map", () => {
    expect(parseCookieHeader("a=1; b=2")).toEqual({ a: "1", b: "2" });
  });

  it("returns an empty map for a missing header", () => {
    expect(parseCookieHeader(undefined)).toEqual({});
  });

  it("decodes URL-encoded cookie values (e.g. the next-auth session JWT)", () => {
    expect(parseCookieHeader("token=a%3Bb")).toEqual({ token: "a;b" });
  });
});
