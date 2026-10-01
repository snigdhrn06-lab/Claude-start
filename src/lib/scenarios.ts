import type { PaymentDetails } from "./types";

// All scenarios are synthetic. Names, handles and account numbers are fictional.

export interface Scenario {
  id: string;
  title: string;
  short: string;
  channel: string;
  description: string;
  conversation: string;
  payment: PaymentDetails;
  /** Sentence used by the Counterfactual Lab. */
  pivot?: { context: string; original: string; safe: string };
}

export const SCENARIOS: Scenario[] = [
  {
    id: "kyc",
    title: "Fake KYC Expiry",
    short: "KYC Impersonation",
    channel: "SMS → WhatsApp call",
    description: "A caller posing as a bank's KYC cell manufactures a 30-minute deadline and asks for a refundable deposit.",
    conversation: [
      "SecureBank Alerts: Dear Customer, your SecureBank KYC is pending as per RBI guidelines. Please update it to continue using all banking services.",
      "You: I updated my KYC last year. Is this genuine?",
      "SecureBank KYC Desk: Good afternoon, this is Rohit Verma from the SecureBank KYC Verification Cell. Our system shows your Aadhaar–PAN linking failed during the re-KYC cycle.",
      "SecureBank KYC Desk: Your account will be frozen within 30 minutes if verification is not completed. All UPI and card transactions will be blocked.",
      "You: Can I just visit the branch tomorrow?",
      "SecureBank KYC Desk: Branch verification takes 7 working days, your account will be frozen by then. Online verification needs a refundable security deposit.",
      "SecureBank KYC Desk: Transfer ₹18,500 immediately to verify-kyc@upi. The amount will be credited back within 2 hours.",
      "SecureBank KYC Desk: Please do not disconnect or discuss this with anyone, it will delay the process.",
    ].join("\n"),
    payment: { recipient: "verify-kyc@upi", amount: 18500, method: "UPI", reason: "KYC verification deposit" },
    pivot: {
      context: "SecureBank KYC Desk: Dear customer, this is the SecureBank KYC Verification Cell. As per RBI guidelines your KYC is pending.",
      original: "Transfer ₹18,500 immediately or your account will be frozen.",
      safe: "Please visit the institution's official website and contact customer support.",
    },
  },
  {
    id: "investment",
    title: "Guaranteed-Return Investment",
    short: "Investment Scam",
    channel: "Telegram → WhatsApp",
    description: "A self-styled advisor promises fixed monthly returns, shows social proof and closes the window tonight.",
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
    pivot: {
      context: "Priya (Apex Wealth): I'm a SEBI-registered advisor with Apex Wealth Partners.",
      original: "Our fund gives guaranteed 18% monthly returns, transfer ₹75,000 tonight before the window closes.",
      safe: "Please verify my registration on the regulator's official website before investing anything.",
    },
  },
  {
    id: "refund",
    title: "Marketplace Refund Reversal",
    short: "Fake Refund",
    channel: "Phone call → UPI",
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
    pivot: {
      context: "ShopKart Support: Your refund for order #SK-48213 failed due to a bank mismatch.",
      original: "Send ₹12,999 to refunds.shopkart@ybl within 20 minutes or the refund will be cancelled permanently.",
      safe: "It will be retried automatically to your original payment method; check the status in the official ShopKart app.",
    },
  },
];

/** Additional synthetic scans that pre-populate Scan History. */
export const HISTORY_SEEDS: { id: string; title: string; dayOffset: number; hour: number; conversation: string; payment?: PaymentDetails }[] = [
  { id: "seed-kyc", title: "KYC Impersonation", dayOffset: 0, hour: 14, conversation: SCENARIOS[0].conversation, payment: SCENARIOS[0].payment },
  { id: "seed-invest", title: "Investment Scam", dayOffset: 0, hour: 11, conversation: SCENARIOS[1].conversation, payment: SCENARIOS[1].payment },
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
  },
  {
    id: "seed-unknown",
    title: "Unknown Beneficiary",
    dayOffset: 1,
    hour: 19,
    conversation: [
      "Vikram: Hey, it's Vikram from the cricket group. Got a new number.",
      "Vikram: I'm stuck at the hospital billing counter, can you send ₹9,000 to vikram.m88@okaxis right now? Will return tomorrow.",
    ].join("\n"),
    payment: { recipient: "vikram.m88@okaxis", amount: 9000, method: "UPI", reason: "Help a friend" },
  },
  {
    id: "seed-rent",
    title: "Rent Payment",
    dayOffset: 1,
    hour: 10,
    conversation: "Mr. Sharma: Hi Ananya, October rent of ₹22,000 is due on the 5th. Please pay to the usual UPI ID. Thanks!",
    payment: { recipient: "landlord.sharma@okhdfc", amount: 22000, method: "UPI", reason: "Monthly rent" },
  },
];

export function getScenario(id: string) {
  return SCENARIOS.find((s) => s.id === id);
}
