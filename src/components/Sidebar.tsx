import type { ReactNode } from "react";
import { useLedger } from "../lib/store";
import { fmtShort } from "../lib/money";
import type { CatTotal, ViewKey } from "../lib/types";
import {
  IconAccounts,
  IconBudget,
  IconDownload,
  IconFlow,
  IconFood,
  IconOverview,
  IconShop,
  IconStats,
  IconTraffic,
} from "./Icons";

interface Props {
  count: number;
  catTotals: CatTotal[];
  onExport: () => void;
}

const NAV: { key: ViewKey; label: string; icon: ReactNode; kbd: string }[] = [
  { key: "overview", label: "概览", icon: <IconOverview />, kbd: "⌘1" },
  { key: "flow", label: "流水", icon: <IconFlow />, kbd: "⌘2" },
  { key: "stats", label: "统计", icon: <IconStats />, kbd: "⌘3" },
  { key: "budget", label: "预算", icon: <IconBudget />, kbd: "⌘4" },
  { key: "accounts", label: "账户", icon: <IconAccounts />, kbd: "⌘5" },
];

const QUICK_CATS = [
  { name: "餐饮", icon: <IconFood /> },
  { name: "交通", icon: <IconTraffic /> },
  { name: "购物", icon: <IconShop /> },
];

export function Sidebar({ count, catTotals, onExport }: Props) {
  const { view, setView, categories, setFlowQuery } = useLedger();

  const totalOf = (name: string) => {
    const cat = categories.find((c) => c.name === name && c.kind === "expense");
    if (!cat) return null;
    const row = catTotals.find((c) => c.categoryId === cat.id);
    return row ? fmtShort(row.total) : "—";
  };

  const goCategory = (name: string) => {
    setFlowQuery(name);
    setView("flow");
  };

  return (
    <aside className="sb">
      <div className="brand" data-tauri-drag-region>
        <div className="brand-mark">账</div>
        <div className="brand-txt">
          <b>墨账</b>
          <span>Ink Ledger</span>
        </div>
      </div>

      <nav className="nav">
        {NAV.map((item) => (
          <button
            key={item.key}
            className={`nav-item ${view === item.key ? "active" : ""}`}
            onClick={() => setView(item.key)}
          >
            {item.icon}
            {item.label}
            <span className="kbd">{item.kbd}</span>
          </button>
        ))}

        <div className="nav-label">分类</div>
        {QUICK_CATS.map((c) => (
          <button key={c.name} className="nav-item" onClick={() => goCategory(c.name)}>
            {c.icon}
            {c.name}
            <span className="kbd">¥{totalOf(c.name)}</span>
          </button>
        ))}
      </nav>

      <div className="sb-foot">
        <div className="sb-stat">
          <span>本月记账</span>
          <b>{count} 笔</b>
        </div>
        <button className="nav-item" onClick={onExport}>
          <IconDownload />
          导出备份
        </button>
      </div>
    </aside>
  );
}
