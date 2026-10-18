import type { AccountContextInput, ContextSummary } from "../types";

/**
 * Account context: beneficiary and amount history used for transaction and
 * recipient signals.
 *
 * Sentinel has no access to anyone's real bank data. Context comes from one of
 * three places, and every analysis says which one it used:
 *   - "user": the person typed their saved recipients / typical payment size.
 *   - "demo": the fixed synthetic profile below, used by demo scenarios.
 *   - "none": nothing is known. Beneficiary and amount signals are not raised;
 *             the gap is reported as missing information instead.
 *
 * A future authorised integration (e.g. a bank's beneficiary list via an
 * account-aggregator consent flow) implements AccountContextProvider and
 * plugs in without touching detection or scoring.
 */
export interface BeneficiaryLookup {
  status: "known" | "not_in_list" | "unknown";
}

export interface AccountContextProvider {
  readonly mode: AccountContextInput["mode"];
  readonly label: string;
  lookupBeneficiary(recipient: string): BeneficiaryLookup;
  /** Typical outgoing payment for this account, or null when unknown. */
  typicalOutgoing(): number | null;
  describe(): string;
}

/** Synthetic demo profile. Fictional person; never presented as a real user's history. */
export const DEMO_PROFILE = {
  holder: "Ananya Rao (synthetic)",
  typicalOutgoing: 2400,
  knownBeneficiaries: ["landlord.sharma@okhdfc", "mom.rao@oksbi", "rahul.k@okicici", "bescom@billdesk", "swiggy@icici"],
};

/** @deprecated kept for older imports; use DEMO_PROFILE. */
export const ACCOUNT_PROFILE = DEMO_PROFILE;

export function normaliseRecipient(r: string) {
  const s = r.trim().toLowerCase();
  // "AWP Ventures · A/C 50200087561234" → keep the account number as the identity.
  const acct = /(\d{9,18})/.exec(s);
  if (!s.includes("@") && acct) return acct[1];
  return s.replace(/\s+/g, "");
}

class ListContext implements AccountContextProvider {
  private set: Set<string>;
  constructor(
    readonly mode: "demo" | "user",
    readonly label: string,
    beneficiaries: string[],
    private typical: number | null,
  ) {
    this.set = new Set(beneficiaries.map(normaliseRecipient).filter(Boolean));
  }
  lookupBeneficiary(recipient: string): BeneficiaryLookup {
    if (!this.set.size) return { status: "unknown" };
    return { status: this.set.has(normaliseRecipient(recipient)) ? "known" : "not_in_list" };
  }
  typicalOutgoing() {
    return this.typical && this.typical > 0 ? this.typical : null;
  }
  describe() {
    const parts: string[] = [];
    parts.push(this.set.size ? `${this.set.size} saved recipient${this.set.size > 1 ? "s" : ""}` : "no saved-recipient list");
    parts.push(this.typical ? `typical payment ₹${Math.round(this.typical).toLocaleString("en-IN")}` : "no typical payment size");
    return this.mode === "demo"
      ? `Synthetic demo profile (${DEMO_PROFILE.holder}): ${parts.join(", ")}. This is not anyone's real account history.`
      : `Supplied by you: ${parts.join(", ")}. Sentinel has not verified it.`;
  }
}

class NoContext implements AccountContextProvider {
  readonly mode = "none" as const;
  readonly label = "No account history";
  lookupBeneficiary(): BeneficiaryLookup {
    return { status: "unknown" };
  }
  typicalOutgoing() {
    return null;
  }
  describe() {
    return "No account history was provided, so Sentinel cannot tell whether this recipient or amount is unusual for you.";
  }
}

export function contextProvider(input?: AccountContextInput): AccountContextProvider {
  if (!input || input.mode === "none") return new NoContext();
  if (input.mode === "demo") return new ListContext("demo", "Synthetic demo profile", DEMO_PROFILE.knownBeneficiaries, DEMO_PROFILE.typicalOutgoing);
  return new ListContext("user", "Your saved recipients", input.knownBeneficiaries ?? [], input.typicalOutgoing ?? null);
}

export function summariseContext(ctx: AccountContextProvider, recipient?: string): ContextSummary {
  const recipientStatus = recipient ? ctx.lookupBeneficiary(recipient).status : "not_applicable";
  return {
    mode: ctx.mode,
    label: ctx.label,
    description: ctx.describe(),
    recipientStatus,
    typicalOutgoing: ctx.typicalOutgoing(),
  };
}
