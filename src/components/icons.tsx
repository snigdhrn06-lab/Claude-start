import {
  Activity,
  ArrowLeftRight,
  BadgePercent,
  Banknote,
  EyeOff,
  HeartHandshake,
  Hourglass,
  KeyRound,
  Landmark,
  Link2Off,
  Lock,
  RotateCcw,
  ShieldCheck,
  Timer,
  TrendingUp,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { SignalId } from "@/lib/types";

export const SIGNAL_ICONS: Record<SignalId, LucideIcon> = {
  urgency: Timer,
  threat: Lock,
  authority: Landmark,
  guarantee: BadgePercent,
  scarcity: Hourglass,
  social_proof: Users,
  refund: RotateCcw,
  reversal: ArrowLeftRight,
  payment_request: Banknote,
  isolation: EyeOff,
  credentials: KeyRound,
  escalation: TrendingUp,
  emotional: HeartHandshake,
  new_beneficiary: UserPlus,
  unofficial_channel: Link2Off,
  amount_anomaly: Activity,
  verification: ShieldCheck,
};

/** Sentinel mark: an aperture closing over a vertical "pause" bar. */
export function SentinelMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M12 2.5 20 6v6.2c0 4.6-3.3 8.2-8 9.3-4.7-1.1-8-4.7-8-9.3V6l8-3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="9" y="8" width="2" height="8" rx="0.6" fill="#ff4a3d" />
      <rect x="13" y="8" width="2" height="8" rx="0.6" fill="currentColor" />
    </svg>
  );
}
