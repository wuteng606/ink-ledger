import { invoke } from "@tauri-apps/api/core";
import { mockApi } from "./mock";
import type {
  AccountRow,
  Bootstrap,
  BudgetOverview,
  MonthPoint,
  Overview,
  StatsBundle,
  Tx,
  TxInput,
} from "./types";

/** 不在 Tauri 里（比如直接开 vite dev）时走内存假数据 */
const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const call = <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
  if (inTauri) return invoke<T>(cmd, args);
  return mockCall<T>(cmd, args);
};

const mockCall = <T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> => {
  const m = mockApi as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>;
  const map: Record<string, () => Promise<unknown>> = {
    bootstrap: () => m.bootstrap(),
    get_overview: () => m.overview(args.month as string),
    get_flow: () => m.flow(args.month as string, args.kind as string, args.query as string),
    get_stats: () => m.stats(args.month as string),
    get_budget: () => m.budget(args.month as string),
    get_accounts: () => m.accounts(args.month as string),
    create_transaction: () => m.create(args.input as TxInput),
    update_transaction: () => m.update(args.id as number, args.input as TxInput),
    delete_transaction: () => m.remove(args.id as number),
    set_budget: () => m.setBudget(args.categoryId as number, args.amount as number),
    set_account_balance: () => m.setBalance(args.id as number, args.balance as number),
    export_csv: () => m.exportCsv(),
    backup_now: () => m.backup(),
  };
  const fn = map[cmd];
  if (!fn) return Promise.reject(new Error(`未知命令: ${cmd}`));
  return fn() as Promise<T>;
};

export const api = {
  bootstrap: () => call<Bootstrap>("bootstrap"),

  overview: (month: string) => call<Overview>("get_overview", { month }),

  flow: (month: string, kind: string, query: string) =>
    call<Tx[]>("get_flow", { month, kind, query }),

  stats: (month: string) => call<StatsBundle>("get_stats", { month }),

  budget: (month: string) => call<BudgetOverview>("get_budget", { month }),

  accounts: (month: string) => call<AccountRow[]>("get_accounts", { month }),

  createTx: (input: TxInput) => call<number>("create_transaction", { input }),

  updateTx: (id: number, input: TxInput) =>
    call<void>("update_transaction", { id, input }),

  deleteTx: (id: number) => call<void>("delete_transaction", { id }),

  setBudget: (categoryId: number, amount: number) =>
    call<void>("set_budget", { categoryId, amount }),

  setBalance: (id: number, balance: number) =>
    call<void>("set_account_balance", { id, balance }),

  exportCsv: () => call<string>("export_csv"),

  backup: () => call<string>("backup_now"),
};

export type { MonthPoint };
export const isMock = !inTauri;
