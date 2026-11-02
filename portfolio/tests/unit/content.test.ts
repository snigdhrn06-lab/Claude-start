import { describe, expect, it } from "vitest";
import { mailtoUrl, telUrl, whatsappUrl } from "@/lib/contact";
import { parseSettings, siteSettingsSchema } from "@/lib/content/settings";
import { emphasisSegments, slugify, stripEmphasis } from "@/lib/utils";
import { connectionConfig } from "@/lib/db/client";

describe("contact links", () => {
  it("builds a wa.me link with an encoded message", () => {
    expect(whatsappUrl("+91 63616 86265", "Hi Snigdh, let's talk & connect?")).toBe("https://wa.me/916361686265?text=Hi%20Snigdh%2C%20let's%20talk%20%26%20connect%3F");
    expect(whatsappUrl("")).toBeNull();
  });
  it("builds mailto and tel links", () => {
    expect(mailtoUrl("a@b.co", "Hello there")).toBe("mailto:a@b.co?subject=Hello%20there");
    expect(telUrl("+91 63616 86265")).toBe("tel:+916361686265");
  });
});

describe("text helpers", () => {
  it("slugifies titles", () => {
    expect(slugify("Marked to Market, Mistaken for Money!")).toBe("marked-to-market-mistaken-for-money");
    expect(slugify("Rupee–Yuan Rotation")).toBe("rupee-yuan-rotation");
  });
  it("parses *emphasis*", () => {
    expect(emphasisSegments("Let's talk *markets*.")).toEqual([
      { text: "Let's talk ", em: false },
      { text: "markets", em: true },
      { text: ".", em: false },
    ]);
    expect(stripEmphasis("a *b* c")).toBe("a b c");
  });
});

describe("site settings", () => {
  it("fills defaults and always includes every section once", () => {
    const s = siteSettingsSchema.parse({ sections: [{ key: "contact", label: "Say hi", visible: true }, { key: "contact", visible: false }] });
    expect(s.sections.map((x) => x.key)).toEqual(["contact", "about", "research", "projects", "achievements", "experience", "skills"]);
    expect(s.sections[0]!.label).toBe("Say hi");
  });
  it("normalises the WhatsApp number to digits", () => {
    expect(siteSettingsSchema.parse({ whatsappNumber: "+91 63616-86265" }).whatsappNumber).toBe("916361686265");
  });
  it("survives corrupt data by keeping valid fields", () => {
    const s = parseSettings({ name: "Valid Name", email: "not-an-email", accent: "purple" });
    expect(s.name).toBe("Valid Name");
    expect(s.email).toBe("");
    expect(s.accent).toBe("lime");
  });
});

describe("database SSL configuration", () => {
  it("disables SSL for local and Render-internal hosts, verifies elsewhere", () => {
    expect(connectionConfig("postgres://u:p@localhost:5432/db").ssl).toBe(false);
    expect(connectionConfig("postgres://u:p@dpg-abc123-a/db").ssl).toBe(false);
    expect(connectionConfig("postgresql://u:p@ep-x.neon.tech/db?sslmode=require").ssl).toEqual({ rejectUnauthorized: true });
    expect(connectionConfig("postgresql://u:p@ep-x.neon.tech/db?sslmode=require").connectionString).not.toContain("sslmode");
  });
});
