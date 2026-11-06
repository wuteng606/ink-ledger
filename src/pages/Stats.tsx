import { useMemo } from "react";
import { api } from "../lib/api";
import { fmtShort } from "../lib/money";
import { useAsync, useLedger } from "../lib/store";

const WD_LABEL = ["日", "一", "二", "三", "四", "五", "六"];
const WD_FULL = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function Stats() {
  const { month, version, catMap } = useLedger();
  const { data } = useAsync(() => api.stats(month), [month, version]);

  const rank = useMemo(() => {
    if (!data) return [];
    const total = data.expense || 1;
    return data.categories.map((c) => ({
      ...c,
      cat: catMap.get(c.categoryId),
      pct: (c.total / total) * 100,
    }));
  }, [data, catMap]);

  if (!data) return <div className="empty">正在统计…</div>;

  const weekMax = Math.max(...data.weekday, 1);
  const peak = data.weekday.indexOf(Math.max(...data.weekday));
  const seriesMax = Math.max(...data.series.flatMap((s) => [s.expense, s.income]), 1);

  return (
    <div className="view">
      <div className="row-2">
        <div className="panel">
          <div className="p-head">
            <span className="p-title">分类排行</span>
            <span className="p-note">合计 ¥{fmtShort(data.expense)}</span>
          </div>
          <div className="rank">
            {rank.length === 0 && (
              <div style={{ color: "var(--tx-3)", fontSize: 12.5, padding: "10px 0" }}>
                本月还没有支出
              </div>
            )}
            {rank.map((r, idx) => (
              <div className="rank-row" key={r.categoryId}>
                <div
                  className="rank-ico"
                  style={{ background: `${r.cat?.color ?? "#8a93a3"}22` }}
                >
                  {r.cat?.icon ?? "🧾"}
                </div>
                <div className="rank-body">
                  <div className="rank-top">
                    <span>{r.cat?.name ?? "其他"}</span>
                    <em>{r.pct.toFixed(1)}%</em>
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${Math.max(r.pct, 0.6)}%`,
                        background: r.cat?.color ?? "var(--gold)",
                        opacity: 0.85,
                      }}
                    />
                  </div>
                </div>
                <div className="rank-val">
                  ¥{fmtShort(r.total)}
                  <small>
                    {idx + 1} / {rank.length}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="p-head">
            <span className="p-title">一周节律</span>
            <span className="p-note">近 30 天 · 按周几</span>
          </div>
          <div className="week-bars">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <div className={`week-col ${d === peak ? "on" : ""}`} key={d}>
                <i
                  style={{
                    height: `${Math.max((data.weekday[d] / weekMax) * 100, 2)}%`,
                  }}
                />
                <span>{WD_LABEL[d]}</span>
              </div>
            ))}
          </div>
          <div className="p-note" style={{ marginTop: 12 }}>
            {weekMax > 0 ? `${WD_FULL[peak]}花得最多` : "还没有足够数据"}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="p-head">
          <span className="p-title">近 6 个月</span>
          <span className="p-note" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <i style={{ width: 7, height: 7, borderRadius: 2, background: "var(--gold)", opacity: 0.8 }} />
              支出
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <i style={{ width: 7, height: 7, borderRadius: 2, background: "var(--inc)", opacity: 0.65 }} />
              收入
            </span>
          </span>
        </div>
        <div className="bars bars--spread" style={{ height: 200 }}>
          {data.series.map((s) => (
            <div className="bar" key={s.month} style={{ gap: 2 }}>
              <i
                style={{
                  height: `${(s.expense / seriesMax) * 74}%`,
                  maxWidth: 13,
                }}
              />
              <i
                style={{
                  height: `${(s.income / seriesMax) * 74}%`,
                  maxWidth: 13,
                  background: "linear-gradient(180deg, var(--inc), rgba(72,207,155,.25))",
                  opacity: 0.55,
                }}
              />
            </div>
          ))}
        </div>
        <div className="x-axis x-axis--grid">
          {data.series.map((s) => (
            <span key={s.month}>{Number(s.month.slice(5))}月</span>
          ))}
        </div>
      </div>
    </div>
  );
}
