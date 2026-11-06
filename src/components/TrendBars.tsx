import type { CSSProperties } from "react";
import { fmtShort } from "../lib/money";
import type { DayTotal } from "../lib/types";

interface Props {
  daily: DayTotal[];
  showDays: number;
  month: string;
}

export function TrendBars({ daily, showDays, month }: Props) {
  const map = new Map(daily.map((d) => [d.day, d.total]));
  const values = Array.from({ length: Math.max(showDays, 1) }, (_, i) => map.get(i + 1) ?? 0);
  const max = Math.max(...values, 1);

  const bw = showDays <= 8 ? 40 : showDays <= 15 ? 32 : 24;
  const gap = showDays > 20 ? 3 : 9;

  const marks = [1, Math.ceil(showDays / 2), showDays];
  const mm = month.slice(5, 7);

  return (
    <>
      <div
        className="bars"
        style={{ gap, "--bw": `${bw}px` } as CSSProperties}
      >
        {values.map((v, i) => {
          const h = Math.max((v / max) * 88, v > 0 ? 8 : 2);
          return (
            <div key={i} className="bar" style={{ "--h": `${h.toFixed(1)}%` } as CSSProperties}>
              <span className="tip">
                {`${Number(mm)}/${String(i + 1).padStart(2, "0")} ¥${fmtShort(v)}`}
              </span>
              <i />
            </div>
          );
        })}
      </div>
      <div className="x-axis">
        {marks.map((n, i) => (
          <span key={i}>
            {mm}/{String(n).padStart(2, "0")}
          </span>
        ))}
      </div>
    </>
  );
}
