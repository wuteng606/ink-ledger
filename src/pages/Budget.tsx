import { useState } from "react";
import { api } from "../lib/api";
import { fmtShort, parseAmount } from "../lib/money";
import { useAsync, useLedger } from "../lib/store";

export function Budget() {
  const { month, version, catMap, touch, toast } = useLedger();
  const { data } = useAsync(() => api.budget(month), [month, version]);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  if (!data) return <div className="empty">正在算预算…</div>;

  const left = data.total - data.used;
  const restDays = Math.max(data.daysInMonth - data.passedDays, 1);
  const daily = Math.max(left, 0) / restDays;

  const rows = [...data.rows].sort((a, b) => {
    const pa = a.budget > 0 ? a.used / a.budget : 0;
    const pb = b.budget > 0 ? b.used / b.budget : 0;
    return pb - pa;
  });

  const commit = async (categoryId: number) => {
    const cents = parseAmount(draft);
    setEditing(null);
    if (cents <= 0) return;
    try {
      await api.setBudget(categoryId, cents);
      touch();
      toast(`预算已改为 ¥${fmtShort(cents)}`);
    } catch (e) {
      console.error(e);
      toast("预算保存失败");
    }
  };

  return (
    <div className="view">
      <div className="budget-hero">
        <div>
          <div className="bh-num">
            <b>{fmtShort(Math.max(left, 0))}</b>
            <span>元可用</span>
          </div>
          <div className="bh-sub">
            {left >= 0
              ? `还剩 ${restDays} 天，日均可用 ¥${fmtShort(daily)}`
              : `已超出预算 ¥${fmtShort(-left)}，下个月收一收`}
          </div>
        </div>
        <div className="bh-meta">
          <div>
            月度总预算
            <b>¥{fmtShort(data.total)}</b>
          </div>
          <div>
            已花
            <b>¥{fmtShort(data.used)}</b>
          </div>
          <div>
            今日建议上限
            <b>¥{fmtShort(daily)}</b>
          </div>
        </div>
      </div>

      <div className="bud-grid">
        {rows.map((row) => {
          const cat = catMap.get(row.categoryId);
          const pct = row.budget > 0 ? (row.used / row.budget) * 100 : 0;
          const cls = pct >= 100 ? "over" : pct >= 80 ? "warn" : "";
          return (
            <div className="bud-card" key={row.categoryId}>
              <div className="bc-head">
                <div
                  className="bc-ico"
                  style={{ background: `${cat?.color ?? "#8a93a3"}22` }}
                >
                  {cat?.icon ?? "🧾"}
                </div>
                <span className="bc-name">{cat?.name ?? "其他"}</span>
                <span
                  className="bc-pct"
                  style={{ color: pct >= 100 ? "var(--exp)" : undefined }}
                >
                  {row.budget > 0 ? `${pct.toFixed(0)}%` : "未设"}
                </span>
              </div>
              <div className="bar-track">
                <div
                  className={`bar-fill ${cls}`}
                  style={{
                    width: `${Math.min(pct, 100)}%`,
                    ...(cls ? {} : { background: cat?.color ?? "var(--gold)" }),
                  }}
                />
              </div>
              <div className="bc-foot">
                <span>
                  已用 <b>¥{fmtShort(row.used)}</b>
                </span>
                {editing === row.categoryId ? (
                  <input
                    autoFocus
                    value={draft}
                    style={{
                      width: 74,
                      height: 22,
                      textAlign: "right",
                      background: "var(--field)",
                      color: "var(--tx)",
                      border: "1px solid var(--line-2)",
                      borderRadius: 6,
                      fontFamily: "var(--mono)",
                      fontSize: 11.5,
                      padding: "0 6px",
                      outline: "none",
                    }}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => void commit(row.categoryId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void commit(row.categoryId);
                      if (e.key === "Escape") setEditing(null);
                    }}
                  />
                ) : (
                  <span
                    style={{ cursor: "pointer" }}
                    title="点击修改预算"
                    onClick={() => {
                      setEditing(row.categoryId);
                      setDraft((row.budget / 100).toFixed(0));
                    }}
                  >
                    {row.budget > 0 ? (
                      <>
                        预算 <b>¥{fmtShort(row.budget)}</b>
                      </>
                    ) : (
                      <span style={{ color: "var(--gold-2)" }}>点击设置</span>
                    )}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
