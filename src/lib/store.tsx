import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { api } from "./api";
import { thisMonth } from "./date";
import { isTauri } from "./window";
import type { Account, Category, ViewKey } from "./types";

type Theme = "dark" | "light";

interface LedgerCtx {
  ready: boolean;
  categories: Category[];
  catMap: Map<number, Category>;
  accounts: Account[];
  today: string;
  month: string;
  setMonth: (m: string) => void;
  view: ViewKey;
  setView: (v: ViewKey) => void;
  /** 侧边栏点分类时带过去的关键词 */
  flowQuery: string;
  setFlowQuery: (q: string) => void;
  /** 数据变更后自增，页面据此重新拉数据 */
  version: number;
  touch: () => void;
  toast: (msg: string) => void;
  theme: Theme;
  toggleTheme: () => void;
}

const Ctx = createContext<LedgerCtx | null>(null);

/** 带版本的主题键：旧版本残留的取值不要影响新界面 */
const THEME_KEY = "ink-ledger:theme:v1";

export function LedgerProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [today, setToday] = useState("");
  const [month, setMonth] = useState(thisMonth());
  const [view, setView] = useState<ViewKey>("overview");
  const [flowQuery, setFlowQuery] = useState("");
  const [version, setVersion] = useState(0);
  const [toastMsg, setToastMsg] = useState("");
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === "light" || saved === "dark" ? saved : "dark";
  });
  const timer = useRef<number | null>(null);

  useEffect(() => {
    api
      .bootstrap()
      .then((b) => {
        setCategories(b.categories);
        setAccounts(b.accounts);
        setToday(b.today);
        setMonth(b.month);
        setReady(true);
      })
      .catch((e) => {
        console.error("bootstrap failed", e);
        setReady(true);
      });
  }, []);

  // 主题：写本地 + 广播给其他窗口（主窗口和快速记账窗口要一致）
  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
    if (isTauri) void emit("theme-changed", theme);
  }, [theme]);

  useEffect(() => {
    if (!isTauri) return;
    const p = listen<string>("theme-changed", (e) => {
      const next = e.payload === "light" ? "light" : "dark";
      setTheme((cur) => (cur === next ? cur : next));
    });
    return () => {
      p.then((un) => un()).catch(() => undefined);
    };
  }, []);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToastMsg(""), 2000);
  }, []);

  const touch = useCallback(() => setVersion((v) => v + 1), []);

  const catMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const value: LedgerCtx = {
    ready,
    categories,
    catMap,
    accounts,
    today,
    month,
    setMonth,
    view,
    setView,
    flowQuery,
    setFlowQuery,
    version,
    touch,
    toast,
    theme,
    toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className={`toast ${toastMsg ? "show" : ""}`}>{toastMsg}</div>
    </Ctx.Provider>
  );
}

export function useLedger() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLedger 必须在 LedgerProvider 内使用");
  return ctx;
}

/** 拉数据的小工具：依赖变化时重取，过期响应直接丢弃 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);

  useEffect(() => {
    const id = ++seq.current;
    setLoading(true);
    fn()
      .then((res) => {
        if (id === seq.current) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((e) => {
        console.error(e);
        if (id === seq.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading };
}
