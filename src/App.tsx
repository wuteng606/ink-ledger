import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { api } from "./lib/api";
import { monthLabel, shiftMonth } from "./lib/date";
import { useAsync, useLedger } from "./lib/store";
import { isTauri, win } from "./lib/window";
import { Sidebar } from "./components/Sidebar";
import { EntryModal } from "./components/EntryModal";
import { IconSearch, IconSun } from "./components/Icons";
import { Overview } from "./pages/Overview";
import { Flow } from "./pages/Flow";
import { Stats } from "./pages/Stats";
import { Budget } from "./pages/Budget";
import { Accounts } from "./pages/Accounts";
import type { Tx, ViewKey } from "./lib/types";

const TITLES: Record<ViewKey, string> = {
  overview: "概览",
  flow: "流水",
  stats: "统计",
  budget: "预算",
  accounts: "账户",
};

const VIEW_ORDER: ViewKey[] = ["overview", "flow", "stats", "budget", "accounts"];

export default function App() {
  const { ready, month, setMonth, view, setView, version, theme, toggleTheme, touch, toast } =
    useLedger();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tx | null>(null);

  const { data: side } = useAsync(() => api.overview(month), [month, version]);

  const openNew = useCallback(() => {
    setEditing(null);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((tx: Tx) => {
    setEditing(tx);
    setModalOpen(true);
  }, []);

  // 快速记账窗口保存后通知主窗口刷新
  useEffect(() => {
    if (!isTauri) return;
    const p = listen("ledger-changed", () => touch());
    return () => {
      p.then((un) => un()).catch(() => undefined);
    };
  }, [touch]);

  // 快捷键
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modalOpen) return;
      if (e.metaKey && /^[1-5]$/.test(e.key)) {
        e.preventDefault();
        setView(VIEW_ORDER[Number(e.key) - 1]);
      }
      if (e.metaKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        openNew();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, setView, openNew]);

  const exportCsv = async () => {
    try {
      const res = await api.exportCsv();
      const [path, count] = res.split("|");
      toast(`已导出 ${count} 条 → ${path.split("/").pop()}`);
    } catch (e) {
      console.error(e);
      toast("导出失败，看一下控制台");
    }
  };

  if (!ready) {
    return (
      <div className="app-window">
        <div className="empty" style={{ margin: "auto" }}>
          正在打开账本…
        </div>
      </div>
    );
  }

  return (
    <div className="app-window">
      <header className="chrome" data-tauri-drag-region>
        <div className="lights">
          <i onClick={() => win.close()} title="关闭" />
          <i onClick={() => win.minimize()} title="最小化" />
          <i onClick={() => win.toggleMaximize()} title="缩放" />
        </div>
        <div className="chrome-title">
          <b>墨账</b>
          <span>·</span>
          <span>{monthLabel(month)}</span>
        </div>
        <div className="drag" data-tauri-drag-region />
        <div className="chrome-actions">
          <button className="ibtn" onClick={toggleTheme} title={theme === "dark" ? "切到浅色" : "切到深色"}>
            <IconSun />
          </button>
        </div>
      </header>

      <div className="app">
        <Sidebar
          count={side?.count ?? 0}
          catTotals={side?.categories ?? []}
          onExport={exportCsv}
        />

        <main className="main">
          <div className="topbar">
            <div>
              <h1>{TITLES[view]}</h1>
              <p className="sub">
                {monthLabel(month)} · {side?.count ?? 0} 笔记录
              </p>
            </div>
            <div className="tb-right">
              <div className="month">
                <button onClick={() => setMonth(shiftMonth(month, -1))} title="上一月">
                  ‹
                </button>
                <span>{monthLabel(month)}</span>
                <button onClick={() => setMonth(shiftMonth(month, 1))} title="下一月">
                  ›
                </button>
              </div>
              <button
                className="ibtn"
                title="搜索流水"
                onClick={() => setView("flow")}
              >
                <IconSearch />
              </button>
              <button className="btn-primary" onClick={openNew}>
                ＋ 记一笔
              </button>
            </div>
          </div>

          <div className="scroll">
            {view === "overview" && (
              <Overview onEdit={openEdit} onMore={() => setView("flow")} />
            )}
            {view === "flow" && <Flow onEdit={openEdit} />}
            {view === "stats" && <Stats />}
            {view === "budget" && <Budget />}
            {view === "accounts" && <Accounts />}
          </div>
        </main>
      </div>

      <EntryModal
        open={modalOpen}
        edit={editing}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          touch();
        }}
      />
    </div>
  );
}
