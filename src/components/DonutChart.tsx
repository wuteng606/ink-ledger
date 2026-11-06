import { fmtShort } from "../lib/money";

export interface DonutItem {
  key: string;
  label: string;
  color: string;
  value: number;
}

interface Props {
  items: DonutItem[];
  total: number;
  centerLabel: string;
}

const R = 46;
const C = 2 * Math.PI * R;

export function DonutChart({ items, total, centerLabel }: Props) {
  const t = total || 1;
  let offset = 0;

  return (
    <>
      <div className="donut-box">
        <svg viewBox="0 0 120 120">
          <g transform="rotate(-90 60 60)">
            {items.map((item) => {
              const len = (item.value / t) * C;
              const gap = Math.min(3.5, len * 0.35);
              const dash = `${Math.max(len - gap, 0.1).toFixed(2)} ${C.toFixed(2)}`;
              const el = (
                <circle
                  key={item.key}
                  cx="60"
                  cy="60"
                  r={R}
                  fill="none"
                  stroke={item.color}
                  strokeWidth="11"
                  strokeLinecap="round"
                  strokeDasharray={dash}
                  strokeDashoffset={(-offset).toFixed(2)}
                />
              );
              offset += len;
              return el;
            })}
          </g>
        </svg>
        <div className="donut-center">
          <small>{centerLabel}</small>
          <b>¥{fmtShort(total)}</b>
        </div>
      </div>

      <div className="legend">
        {items.length === 0 && (
          <div className="lg-item" style={{ color: "var(--tx-3)" }}>
            本月还没有支出
          </div>
        )}
        {items.map((item) => (
          <div className="lg-item" key={item.key}>
            <i className="lg-dot" style={{ background: item.color }} />
            <span className="lg-name">{item.label}</span>
            <span className="lg-val">{fmtShort(item.value)}</span>
            <span className="lg-pct">{((item.value / t) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </>
  );
}
