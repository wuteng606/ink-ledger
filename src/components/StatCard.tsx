import { splitAmount } from "../lib/money";

interface Props {
  label: string;
  cents: number;
  badge?: { text: string; tone?: "up" | "down" | "flat" };
  foot: string;
  emph?: boolean;
}

export function StatCard({ label, cents, badge, foot, emph }: Props) {
  const [int, dec] = splitAmount(cents);
  return (
    <div className={`stat-card ${emph ? "emph" : ""}`}>
      <div className="sc-head">
        <span className="sc-label">{label}</span>
        {badge && <span className={`sc-delta ${badge.tone ?? ""}`}>{badge.text}</span>}
      </div>
      <div className="sc-value">
        <span className="cur">¥</span>
        {int}
        <span className="dec">{dec}</span>
      </div>
      <div className="sc-foot">{foot}</div>
    </div>
  );
}
