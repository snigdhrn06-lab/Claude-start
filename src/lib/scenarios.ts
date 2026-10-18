import { DEMO_PROFILE } from "./engine/context";
import type { CounterfactualPreset } from "./engine/counterfactual";
import type { AccountContextInput, PaymentDetails } from "./types";

// All scenarios are synthetic. Names, handles and account numbers are fictional.
// Scenarios are presentation data only: the analysis pipeline never branches on scenario ids.

export interface Scenario {
  id: string;
  title: string;
  short: string;
  channel: string;
  description: string;
  /** What a careful reviewer would conclude. Used to label demos, never to drive scoring. */
  nature: "scam" | "legitimate";
  conversation: string;
  payment: PaymentDetails;
  accountContext: AccountContextInput;
  counterfactuals: CounterfactualPreset[];
}

const DEMO_CONTEXT: AccountContextInput = { mode: "demo" };

const KYC_DEMAND = "Transfer ₹18,500 immediately to verify-kyc@upi. The amount will be credited back within 2 hours.";
const KYC_THREAT = "Your account will be frozen within 30 minutes if verification is not completed. All UPI and card transactions will be blocked.";
const KYC_BRANCH = "Branch verification takes 7 working days, your account will be frozen by then. Online verification needs a refundable security deposit.";
const KYC_ISOLATION = "Please do not disconnect or discuss this with anyone, it will delay the process.";

export const SCENARIOS: Scenario[] = [
  {
    id: "kyc",
    title: "Fake KYC Expiry",
    short: "KYC Impersonation",
    channel: "SMS → WhatsApp call",
    nature: "scam",
    description: "A caller posing as a bank's KYC cell manufactures a 30-minute deadline and asks for a refundable deposit.",
    conversation: [
      "SecureBank Alerts: Dear Customer, your SecureBank KYC is pending as per RBI guidelines. Please update it to continue using all banking services.",
      "You: I updated my KYC last year. Is this genuine?",
      "SecureBank KYC Desk: Good afternoon, this is Rohit Verma from the SecureBank KYC Verification Cell. Our system shows your Aadhaar–PAN linking failed during the re-KYC cycle.",
      `SecureBank KYC Desk: ${KYC_THREAT}`,
      "You: Can I just visit the branch tomorrow?",
      `SecureBank KYC Desk: ${KYC_BRANCH}`,
      `SecureBank KYC Desk: ${KYC_DEMAND}`,
      `SecureBank KYC Desk: ${KYC_ISOLATION}`,
    ].join("\n"),
    payment: { recipient: "verify-kyc@upi", amount: 18500, method: "UPI", reason: "KYC verification deposit" },
    accountContext: DEMO_CONTEXT,
    counterfactuals: [
      {
        id: "official",
        label: "Replace the demand with official-channel advice",
        hypothesis: "Does removing the transfer instruction alone make this safe, while the threats remain?",
        edits: [
          { kind: "replace", find: KYC_DEMAND, replace: "Please complete re-KYC in the official SecureBank app or at your home branch. We will never ask you to transfer money for KYC." },
        ],
      },
      {
        id: "no-threat",
        label: "Remove the threats, keep the payment request",
        hypothesis: "How much of the risk comes from the freeze threat versus the payment request itself?",
        edits: [
          { kind: "replace", find: KYC_THREAT, replace: "Our records show your verification is incomplete." },
          { kind: "replace", find: KYC_BRANCH, replace: "Online verification needs a refundable security deposit." },
        ],
      },
      {
        id: "no-ask",
        label: "Remove every payment request",
        hypothesis: "Is a pressure-heavy message without any ask still high risk?",
        edits: [
          { kind: "replace", find: KYC_DEMAND, replace: "Please complete it as soon as you can." },
          { kind: "replace", find: KYC_BRANCH, replace: "Branch verification takes 7 working days, your account will be frozen by then." },
        ],
      },
      {
        id: "saved",
        label: "Pretend verify-kyc@upi is a saved recipient (synthetic)",
        hypothesis: "Can a familiar recipient offset an impersonation-and-threat pattern? (It should only partly.)",
        synthetic: true,
        edits: [{ kind: "context", accountContext: { mode: "user", knownBeneficiaries: [...DEMO_PROFILE.knownBeneficiaries, "verify-kyc@upi"], typicalOutgoing: DEMO_PROFILE.typicalOutgoing } }],
      },
      {
        id: "otp",
        label: "Add an OTP request",
        hypothesis: "Edits can raise risk too: what does a credential request add?",
        edits: [{ kind: "replace", find: KYC_ISOLATION, replace: "Also share the OTP you just received so I can complete verification." }],
      },
    ],
  },
  {
    id: "investment",
    title: "Guaranteed-Return Investment",
    short: "Investment Scam",
    channel: "Telegram → WhatsApp",
    nature: "scam",
    description: "A self-styled advisor promises fixed monthly returns, shows social proof and closes the window on Friday.",
    conversation: [
      "Priya (Apex Wealth): Hi! Saw your profile in the Smart Investors Telegram group. I'm a SEBI-registered advisor with Apex Wealth Partners.",
      "Priya (Apex Wealth): Our AI arbitrage fund gives guaranteed 18% monthly returns. Zero loss — capital is fully protected.",
      "You: That sounds very high. How can it be guaranteed?",
      "Priya (Apex Wealth): 2,400+ members have already earned this month. I'll share payout screenshots from our group.",
      "Priya (Apex Wealth): Only 3 slots are left in this cycle, it closes on Friday.",
      "Priya (Apex Wealth): Minimum entry is ₹75,000. Transfer to our settlement account A/C 50200087561234, IFSC HDFC0001234, name AWP Ventures.",
      "Priya (Apex Wealth): After your first payout you can upgrade to the Gold tier for 25% returns.",
    ].join("\n"),
    payment: { recipient: "AWP Ventures · A/C 50200087561234", amount: 75000, method: "IMPS / NEFT", reason: "Investment — AI arbitrage fund" },
    accountContext: DEMO_CONTEXT,
    counterfactuals: [
      {
        id: "disclosure",
        label: "Replace the guarantee with a risk disclosure",
        hypothesis: "Is the guaranteed-return promise what drives the assessment?",
        edits: [{ kind: "replace", find: "Our AI arbitrage fund gives guaranteed 18% monthly returns. Zero loss — capital is fully protected.", replace: "Returns are market-linked and you could lose money." }],
      },
      {
        id: "verify-first",
        label: "Ask the user to verify registration before paying",
        hypothesis: "Replace the payment instruction with an independent verification step.",
        edits: [
          { kind: "replace", find: "Minimum entry is ₹75,000. Transfer to our settlement account A/C 50200087561234, IFSC HDFC0001234, name AWP Ventures.", replace: "Before investing anything, please verify my registration on the regulator's official website." },
        ],
      },
      {
        id: "no-pressure",
        label: "Remove social proof and scarcity",
        hypothesis: "The guarantee and payment remain — does removing the pressure tactics change the decision?",
        edits: [
          { kind: "replace", find: "2,400+ members have already earned this month. I'll share payout screenshots from our group.", replace: "Let me know if you have questions." },
          { kind: "replace", find: "Only 3 slots are left in this cycle, it closes on Friday.", replace: "There is no deadline." },
        ],
      },
    ],
  },
  {
    id: "refund",
    title: "Marketplace Refund Reversal",
    short: "Fake Refund",
    channel: "Phone call → UPI",
    nature: "scam",
    description: "A fake marketplace agent says a failed refund needs a 'verification transfer' that will be returned double.",
    conversation: [
      "ShopKart Support: Hello, this is ShopKart customer care. Your order #SK-48213 (boAt earbuds, ₹12,999) was cancelled and a refund was initiated.",
      "You: Okay. When will I receive it?",
      "ShopKart Support: The refund failed because of a bank mismatch. To process it manually, our system needs a verification transfer of the same amount.",
      "ShopKart Support: Please send ₹12,999 to refunds.shopkart@ybl. The total ₹25,998 will be credited back to your account within 15 minutes.",
      "You: Why do I need to pay to get a refund?",
      "ShopKart Support: This is the standard reversal procedure. Please complete it in the next 20 minutes, otherwise the refund request will lapse.",
    ].join("\n"),
    payment: { recipient: "refunds.shopkart@ybl", amount: 12999, method: "UPI", reason: "Refund verification transfer" },
    accountContext: DEMO_CONTEXT,
    counterfactuals: [
      {
        id: "deadline",
        label: "Remove only the deadline",
        hypothesis: "Pay-to-receive is the core mechanism; does removing urgency fix it?",
        edits: [{ kind: "replace", find: "Please complete it in the next 20 minutes, otherwise the refund request will lapse.", replace: "Please complete it when convenient." }],
      },
      {
        id: "auto",
        label: "Say the refund retries automatically",
        hypothesis: "Replace the transfer instruction, but leave the earlier ‘verification transfer’ sentence in place.",
        edits: [
          { kind: "replace", find: "Please send ₹12,999 to refunds.shopkart@ybl. The total ₹25,998 will be credited back to your account within 15 minutes.", replace: "It will be retried automatically to your original payment method; you can check the status in the official ShopKart app." },
        ],
      },
      {
        id: "auto-full",
        label: "Remove every pay-to-receive element",
        hypothesis: "With no transfer requested anywhere, what remains?",
        edits: [
          { kind: "replace", find: "To process it manually, our system needs a verification transfer of the same amount.", replace: "We are retrying it." },
          { kind: "replace", find: "Please send ₹12,999 to refunds.shopkart@ybl. The total ₹25,998 will be credited back to your account within 15 minutes.", replace: "It will be retried automatically to your original payment method; you can check the status in the official ShopKart app." },
          { kind: "replace", find: "This is the standard reversal procedure. Please complete it in the next 20 minutes, otherwise the refund request will lapse.", replace: "No action is needed from you." },
        ],
      },
    ],
  },
  {
    id: "medical",
    title: "Urgent Hospital Deposit (legitimate)",
    short: "Legit Urgent Payment",
    channel: "WhatsApp (saved contact)",
    nature: "legitimate",
    description: "A parent asks for an urgent, unusually large hospital deposit to their usual UPI handle. Urgent and large — but not manipulation.",
    conversation: [
      "Mom: Ananya, Papa was admitted to City Care Hospital this morning. He is stable now, don't panic.",
      "Mom: The hospital needs a ₹40,000 advance deposit paid today before the procedure tomorrow.",
      "Mom: Can you send ₹40,000 to my account mom.rao@oksbi urgently? I'll pay at the counter from there.",
      "You: Calling you now.",
      "Mom: Ok beta. The estimate is also in the hospital's app if you want to check.",
    ].join("\n"),
    payment: { recipient: "mom.rao@oksbi", amount: 40000, method: "UPI", reason: "Hospital deposit for Papa" },
    accountContext: DEMO_CONTEXT,
    counterfactuals: [
      {
        id: "new-number",
        label: "Make it come from a ‘new number’",
        hypothesis: "The same request from an unverified identity is a common scam pattern. Does risk rise?",
        edits: [{ kind: "replace", find: "Mom: Ananya, Papa was admitted", replace: "Mom: Ananya, this is my new number, my phone broke. Papa was admitted" }],
      },
      {
        id: "unknown-recipient",
        label: "Pay an unsaved handle instead",
        hypothesis: "Change only the destination to a handle not in the saved list.",
        edits: [{ kind: "replace", find: "mom.rao@oksbi", replace: "citycare.billing99@okaxis" }],
      },
      {
        id: "no-context",
        label: "Remove account context",
        hypothesis: "Without any history, Sentinel cannot see that this is a saved recipient.",
        synthetic: true,
        edits: [{ kind: "context", accountContext: { mode: "none" } }],
      },
    ],
  },
];

/** Additional synthetic scans that pre-populate Scan History. */
export const HISTORY_SEEDS: { id: string; title: string; dayOffset: number; hour: number; conversation: string; payment?: PaymentDetails; accountContext: AccountContextInput }[] = [
  { id: "seed-kyc", title: "KYC Impersonation", dayOffset: 0, hour: 14, conversation: SCENARIOS[0].conversation, payment: SCENARIOS[0].payment, accountContext: DEMO_CONTEXT },
  { id: "seed-invest", title: "Investment Scam", dayOffset: 0, hour: 11, conversation: SCENARIOS[1].conversation, payment: SCENARIOS[1].payment, accountContext: DEMO_CONTEXT },
  {
    id: "seed-refund-lite",
    title: "Marketplace Refund",
    dayOffset: 0,
    hour: 9,
    conversation: [
      "ShopKart Help: Hi, your return request for order #SK-30117 is approved. A refund of ₹2,499 is pending.",
      "You: Great, thank you.",
      "ShopKart Help: To receive the refund, please approve the collect request we sent to your UPI app.",
    ].join("\n"),
    payment: { recipient: "shopkart.refunds@paytm", amount: 2499, method: "UPI collect request", reason: "Approve refund" },
    accountContext: DEMO_CONTEXT,
  },
  {
    id: "seed-unknown",
    title: "New-Number Emergency",
    dayOffset: 1,
    hour: 19,
    conversation: [
      "Vikram: Hey, it's Vikram from the cricket group. Got a new number.",
      "Vikram: I'm stuck at the hospital billing counter, can you send ₹9,000 to vikram.m88@okaxis right now? Will return tomorrow.",
    ].join("\n"),
    payment: { recipient: "vikram.m88@okaxis", amount: 9000, method: "UPI", reason: "Help a friend" },
    accountContext: DEMO_CONTEXT,
  },
  {
    id: "seed-rent",
    title: "Rent Payment",
    dayOffset: 1,
    hour: 10,
    conversation: "Mr. Sharma: Hi Ananya, October rent of ₹22,000 is due on the 5th. Please pay to the usual UPI ID. Thanks!",
    payment: { recipient: "landlord.sharma@okhdfc", amount: 22000, method: "UPI", reason: "Monthly rent" },
    accountContext: DEMO_CONTEXT,
  },
];

export function getScenario(id: string) {
  return SCENARIOS.find((s) => s.id === id);
}

export function scenarioInput(s: Scenario, withPayment = true) {
  return {
    conversation: s.conversation,
    payment: withPayment ? s.payment : undefined,
    source: "scenario" as const,
    scenarioId: s.id,
    title: s.short,
    accountContext: s.accountContext,
  };
}
