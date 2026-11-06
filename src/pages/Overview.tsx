import { useMemo } from "react";
import { api } from "../lib/api";
import { fmtShort } from "../lib/money";
import { useAsync, useLedger } from "../lib/store";
import type { DonutItem } from "../components/DonutChart";
import { DonutChart } from "../components/DonutChart";
import { StatCard } from "../components/StatCard";
import { TrendBars } from "../components/TrendBars";
import { FlowRow } from "../components/FlowRow";
import { IconChevronRight } from "../components/Icons";
import type { Tx } from "../lib/types";

interface Props {
  onEdit: (tx: Tx) => void;
  onMore: () => void;
}

export function Overview({ onEdit, onMore }: Props) {
  const { month, version, catMap, setView } = useLedger();

  const { data } = useAsync(() => api.overview(month), [month, version]);
  const { data: budget } = useAsync(() => api.budget(month), [month, version]);

  const donutItems: DonutItem[] = useMemo(() => {
    if (!data) return [];
    const sorted = data.categories;
    const top = sorted.slice(0, 5).map((c) => {
      const cat = catMap.get(c.categoryId);
      return {
        key: String(c.categoryId),
        label: cat?.name ?? "其他",
        color: cat?.color ?? "#6b7382",
        value: c.total,
      };
    });
    const rest = sorted.slice(5).reduce((s, c) => s + c.total, 0);
    if (rest > 0) {
      top.push({ key: "rest", label: "其他", color: "#6b7382", value: rest });
    }
    return top;
  }, [data, catMap]);

  const miniBudget = useMemo(() => {
    if (!budget) return [];
    return budget.rows
      .filter((r) => r.used > 0)
      .map((r) => ({ ...r, pct: r.budget > 0 ? (r.used / r.budget) * 100 : 0 }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3);
  }, [budget]);

  if (!data) {
    return <div className="empty">正在读取账本…</div>;
  }

  const net = data.income - data.expense;
  const avg = data.expense / Math.max(data.passedDays, 1);
  const delta =
    data.prevExpense > 0
      ? ((data.expense - data.prevExpense) / data.prevExpense) * 100
      : 0;

  return (
    <div className="view">
      <div className="stats">
        <StatCard
          label="本月支出"
          cents={data.expense}
          badge={{
            text: `${delta >= 0 ? "↑" : "↓"} ${Math.abs(delta).toFixed(1)}%`,
            tone: delta >= 0 ? "up" : "down",
          }}
          foot={`上月同期 ¥${fmtShort(data.prevExpense)}`}
          emph
        />
        <StatCard
          label="本月收入"
          cents={data.income}
          foot="工资 · 理财 · 报销"
        />
        <StatCard
          label="本月结余"
          cents={net}
          badge={{ text: net >= 0 ? "盈余" : "超支", tone: net >= 0 ? "down" : "up" }}
          foot="收入 − 支出"
        />
        <StatCard
          label="日均支出"
          cents={avg}
          badge={{ text: `${data.passedDays} 天` }}
          foot="含一次性支出"
        />
      </div>

      <div className="row-2">
        <div className="panel">
          <div className="p-head">
            <span className="p-title">每日支出</span>
            <span className="p-note">合计 ¥{fmtShort(data.expense)}</span>
          </div>
          <TrendBars daily={data.daily} showDays={data.passedDays} month={month} />
        </div>

        <div className="panel">
          <div className="p-head">
            <span className="p-title">支出构成</span>
            <span className="p-note">按分类</span>
          </div>
          <div className="donut-wrap">
            <DonutChart items={donutItems} total={data.expense} centerLabel="本月支出" />
          </div>
        </div>
      </div>

      <div className="row-2">
        <div className="panel">
          <div className="p-head">
            <span className="p-title">最近流水</span>
            <button className="ibtn" onClick={onMore} title="查看全部">
              <IconChevronRight />
            </button>
          </div>
          <div className="flow-list">
            {data.recent.slice(0, 3).map((tx) => (
              <FlowRow key={tx.id} tx={tx} onEdit={onEdit} />
            ))}
            {data.recent.length === 0 && (
              <div style={{ padding: "26px 0", textAlign: "center", color: "var(--tx-3)", fontSize: 13 }}>
                这个月还没有记录
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="p-head">
            <button
              className="p-title"
              style={{ background: "none", border: 0, color: "inherit", cursor: "pointer", padding: 0 }}
              onClick={() => setView("budget")}
            >
              预算余量
            </button>
            <span className="p-note">
              已用 {data.budgetTotal > 0 ? ((data.budgetUsed / data.budgetTotal) * 100).toFixed(0) : 0}%
            </span>
          </div>
          <div className="bud">
            {miniBudget.map((b) => {
              const cat = catMap.get(b.categoryId);
              const cls = b.pct >= 100 ? "over" : b.pct >= 80 ? "warn" : "";
              return (
                <div className="bud-row" key={b.categoryId}>
                  <div className="bud-top">
                    <span className="nm">{cat?.name ?? "其他"}</span>
                    <span className="num">
                      {fmtShort(b.used)} / {fmtShort(b.budget)}
                    </span>
                  </div>
                  <div className="bar-track">
                    <div className={`bar-fill ${cls}`} style={{ width: `${Math.min(b.pct, 100)}%` }} />
                  </div>
                </div>
              );
            })}
            {miniBudget.length === 0 && (
              <div style={{ color: "var(--tx-3)", fontSize: 12.5 }}>本月还没有开始花钱</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
