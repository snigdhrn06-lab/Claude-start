import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { isSameOrigin } from "@/lib/auth/request";
import { contactMessageSchema, linkUrl, optionalUrl, passwordSchema, projectSchema } from "@/lib/content/schemas";

describe("password hashing", () => {
  it("hashes with scrypt and verifies", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(hash).not.toContain("correct horse");
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("wrong password!!", hash)).toBe(false);
  });
  it("uses a unique salt per hash", async () => {
    expect(await hashPassword("same-password-123")).not.toBe(await hashPassword("same-password-123"));
  });
  it("rejects malformed hashes", async () => {
    expect(await verifyPassword("x", "plaintext")).toBe(false);
    expect(await verifyPassword("x", "scrypt$99999999$8$1$a$b")).toBe(false);
  });
  it("enforces a minimum password length", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("long-enough-pass").success).toBe(true);
  });
});

describe("URL validation (XSS hardening)", () => {
  it("accepts http(s) and empty values", () => {
    expect(optionalUrl.parse("https://example.com/x")).toBe("https://example.com/x");
    expect(optionalUrl.parse("")).toBeNull();
    expect(optionalUrl.parse(null)).toBeNull();
  });
  it("rejects javascript: and data: URLs", () => {
    expect(optionalUrl.safeParse("javascript:alert(1)").success).toBe(false);
    expect(optionalUrl.safeParse("data:text/html,<script>").success).toBe(false);
    expect(linkUrl.safeParse("javascript:alert(1)").success).toBe(false);
    expect(linkUrl.safeParse("mailto:a@b.co").success).toBe(true);
  });
  it("validates project input and strips unknown fields", () => {
    const p = projectSchema.parse({ title: "  Test  ", status: "published", evil: "x", liveUrl: "" });
    expect(p.title).toBe("Test");
    expect(p.liveUrl).toBeNull();
    expect("evil" in p).toBe(false);
    expect(projectSchema.safeParse({ title: "" }).success).toBe(false);
    expect(projectSchema.safeParse({ title: "x", status: "live" }).success).toBe(false);
    expect(projectSchema.safeParse({ title: "x", slug: "Bad Slug" }).success).toBe(false);
  });
});

describe("contact form validation", () => {
  it("requires name, valid email and a real message", () => {
    expect(contactMessageSchema.safeParse({ name: "A", email: "nope", message: "hello there friend" }).success).toBe(false);
    expect(contactMessageSchema.safeParse({ name: "A", email: "a@b.co", message: "hi" }).success).toBe(false);
    expect(contactMessageSchema.safeParse({ name: "A", email: "a@b.co", message: "hello there friend" }).success).toBe(true);
  });
  it("rejects a filled honeypot", () => {
    expect(contactMessageSchema.safeParse({ name: "A", email: "a@b.co", message: "hello there friend", website: "spam" }).success).toBe(false);
  });
});

describe("same-origin check", () => {
  it("blocks cross-origin requests", () => {
    expect(isSameOrigin(new Headers({ origin: "https://evil.com", host: "site.com" }))).toBe(false);
    expect(isSameOrigin(new Headers({ origin: "https://site.com", host: "site.com" }))).toBe(true);
    expect(isSameOrigin(new Headers({ host: "site.com" }))).toBe(true);
  });
});
