export type Kind = "expense" | "income";
export type ViewKey = "overview" | "flow" | "stats" | "budget" | "accounts";

export interface Category {
  id: number;
  name: string;
  kind: Kind;
  icon: string;
  color: string;
  sortOrder: number;
}

export interface Account {
  id: number;
  name: string;
  kind: string;
  icon: string;
  color: string;
  initialBalance: number;
  balance: number;
  sortOrder: number;
}

export interface Tx {
  id: number;
  kind: Kind;
  amount: number;
  categoryId: number;
  accountId: number;
  occurredOn: string;
  occurredTime: string | null;
  note: string;
  createdAt: number;
}

export interface DayTotal {
  day: number;
  total: number;
}

export interface CatTotal {
  categoryId: number;
  total: number;
}

export interface Overview {
  expense: number;
  income: number;
  count: number;
  prevExpense: number;
  passedDays: number;
  daily: DayTotal[];
  categories: CatTotal[];
  recent: Tx[];
  budgetTotal: number;
  budgetUsed: number;
}

export interface MonthPoint {
  month: string;
  expense: number;
  income: number;
}

export interface StatsBundle {
  expense: number;
  income: number;
  categories: CatTotal[];
  weekday: number[];
  series: MonthPoint[];
}

export interface BudgetRow {
  categoryId: number;
  budget: number;
  used: number;
}

export interface BudgetOverview {
  total: number;
  used: number;
  passedDays: number;
  daysInMonth: number;
  rows: BudgetRow[];
}

export interface AccountRow {
  id: number;
  name: string;
  kind: string;
  icon: string;
  color: string;
  initialBalance: number;
  balance: number;
  monthExpense: number;
  monthIncome: number;
  sortOrder: number;
}

export interface Bootstrap {
  categories: Category[];
  accounts: Account[];
  today: string;
  month: string;
  dbPath: string;
}

export interface TxInput {
  kind: Kind;
  amount: number;
  categoryId: number;
  accountId: number;
  occurredOn: string;
  occurredTime: string | null;
  note: string;
}
