/**
 * 浏览器里跑 `npm run dev` 时的假后端。
 * 接口形状与 Rust 侧完全一致，方便调 UI，不影响打包后的真机行为。
 */
import type {
  Account,
  AccountRow,
  BudgetOverview,
  BudgetRow,
  Category,
  CatTotal,
  DayTotal,
  MonthPoint,
  Overview,
  StatsBundle,
  Tx,
  TxInput,
} from "./types";
import { daysInMonth, shiftMonth, thisMonth, todayStr, weekdayIndex } from "./date";

const SEED_CATS: Omit<Category, "id" | "sortOrder">[] = [
  { name: "餐饮", kind: "expense", icon: "🍜", color: "#f0975a" },
  { name: "交通", kind: "expense", icon: "🚇", color: "#5aa7f0" },
  { name: "购物", kind: "expense", icon: "🛍️", color: "#c48cf0" },
  { name: "居住", kind: "expense", icon: "🏠", color: "#6fc4a0" },
  { name: "娱乐", kind: "expense", icon: "🎬", color: "#f0c05a" },
  { name: "医疗", kind: "expense", icon: "💊", color: "#ef7b7b" },
  { name: "学习", kind: "expense", icon: "📚", color: "#7d8cf0" },
  { name: "账单", kind: "expense", icon: "💡", color: "#9aa4b6" },
  { name: "人情", kind: "expense", icon: "🎁", color: "#e88fb0" },
  { name: "宠物", kind: "expense", icon: "🐱", color: "#a58cf0" },
  { name: "旅行", kind: "expense", icon: "✈️", color: "#5ec4d6" },
  { name: "其他", kind: "expense", icon: "🧾", color: "#7b8494" },
  { name: "工资", kind: "income", icon: "💼", color: "#48cf9b" },
  { name: "奖金", kind: "income", icon: "🏆", color: "#f0a13a" },
  { name: "理财", kind: "income", icon: "📈", color: "#4ec3d3" },
  { name: "红包", kind: "income", icon: "🧧", color: "#ef6b7d" },
  { name: "报销", kind: "income", icon: "🧮", color: "#8fa3c0" },
  { name: "其他", kind: "income", icon: "➕", color: "#8a93a3" },
];

const CATEGORIES: Category[] = SEED_CATS.map((c, i) => ({
  ...c,
  id: i + 1,
  sortOrder: (i + 1) * 100,
}));

const ACCOUNTS: Account[] = [
  { id: 1, name: "微信零钱", kind: "wallet", icon: "💬", color: "#3fb96b", initialBalance: 2_400_000, balance: 0, sortOrder: 100 },
  { id: 2, name: "支付宝", kind: "wallet", icon: "🅰", color: "#2f8fe0", initialBalance: 1_800_000, balance: 0, sortOrder: 200 },
  { id: 3, name: "招商银行", kind: "bank", icon: "🏦", color: "#d04a45", initialBalance: 6_000_000, balance: 0, sortOrder: 300 },
  { id: 4, name: "现金", kind: "cash", icon: "💵", color: "#8a93a3", initialBalance: 80_000, balance: 0, sortOrder: 400 },
];

const DEFAULT_BUDGETS: Record<string, number> = {
  餐饮: 250000,
  交通: 90000,
  购物: 120000,
  居住: 300000,
  娱乐: 70000,
  医疗: 30000,
  学习: 40000,
  账单: 50000,
};

const budgets = new Map<number, number>();
CATEGORIES.forEach((c) => {
  const v = DEFAULT_BUDGETS[c.name];
  if (c.kind === "expense" && v) budgets.set(c.id, v);
});

let txs: Tx[] = [];
let nextId = 1;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261106);

const POOL: Record<string, [string, number, number][]> = {
  餐饮: [["楼下牛肉面", 2800, 4500], ["公司食堂", 1800, 3000], ["外卖·黄焖鸡", 3200, 5200], ["瑞幸咖啡", 1900, 3200], ["便利店", 800, 2600], ["和同事聚餐", 10000, 18000], ["早餐包子豆浆", 700, 1400], ["水果摊", 1500, 4500], ["奶茶", 1600, 2600]],
  交通: [["地铁", 300, 800], ["打车回家", 2400, 5800], ["共享单车", 150, 400], ["月卡充值", 10000, 15000]],
  购物: [["超市采购", 8000, 22000], ["日用品", 3000, 9000], ["优衣库", 12000, 32000], ["快递费", 800, 2400], ["数据线", 2500, 6000]],
  居住: [["房租", 260000, 260000], ["物业费", 18000, 22000], ["宽带续费", 6000, 12000]],
  娱乐: [["电影票", 4500, 9000], ["健身房月卡", 20000, 30000], ["演出门票", 18000, 38000]],
  医疗: [["药店", 2800, 9000], ["洗牙", 15000, 26000], ["感冒药", 2000, 6000]],
  学习: [["技术书", 5000, 11000], ["网课", 9900, 29900], ["电子书会员", 1900, 3000]],
  账单: [["电费", 8000, 16000], ["水费", 2000, 6000], ["话费", 3900, 9900]],
  人情: [["随份子", 20000, 60000], ["生日礼物", 12000, 30000]],
  宠物: [["猫粮", 12000, 26000], ["猫砂", 6000, 12000]],
  旅行: [["高铁票", 18000, 42000], ["酒店", 30000, 70000]],
  其他: [["维修费", 5000, 20000]],
  工资: [["工资", 780000, 780000]],
  奖金: [["项目奖金", 120000, 300000]],
  理财: [["基金分红", 8000, 22000]],
  红包: [["生日红包", 10000, 50000]],
  报销: [["差旅报销", 30000, 120000]],
};

/** amount 传负数表示收入 */
function push(date: string, name: string, amount: number, note: string, accountId: number) {
  const kind: Tx["kind"] = amount < 0 ? "income" : "expense";
  const cat = CATEGORIES.find((c) => c.name === name && c.kind === kind);
  txs.push({
    id: nextId++,
    kind,
    amount: Math.abs(Math.round(amount)),
    categoryId: cat?.id ?? 1,
    accountId,
    occurredOn: date,
    occurredTime: `${String(8 + Math.floor(rand() * 13)).padStart(2, "0")}:${String(Math.floor(rand() * 60)).padStart(2, "0")}`,
    note,
    createdAt: 0,
  });
}

function seed() {
  const end = todayStr();
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  for (const d = new Date(startDate); ; d.setDate(d.getDate() + 1)) {
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (ds > end) break;
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const day = d.getDate();

    if (day === 1) push(ds, "居住", 260000, "房租", 3);
    if (day === 5) push(ds, "工资", -780000, "工资", 3);
    if (day === 10) {
      push(ds, "账单", 8000 + rand() * 8000, "电费", 2);
      push(ds, "账单", 2200 + rand() * 2600, "水费", 2);
    }
    if (day === 20) {
      push(ds, "理财", -(8000 + rand() * 14000), "基金分红", 3);
      if (rand() < 0.5) push(ds, "奖金", -(150000 + rand() * 150000), "项目奖金", 3);
    }

    const food = weekend ? 2 : rand() < 0.6 ? 2 : 1;
    for (let i = 0; i < food; i++) {
      const p = POOL["餐饮"][Math.floor(rand() * POOL["餐饮"].length)];
      push(ds, "餐饮", p[1] + rand() * (p[2] - p[1]), p[0], [1, 2, 1, 2, 3][Math.floor(rand() * 5)]);
    }
    if (weekend ? rand() < 0.3 : rand() < 0.85) {
      const p = POOL["交通"][Math.floor(rand() * POOL["交通"].length)];
      push(ds, "交通", p[1] + rand() * (p[2] - p[1]), p[0], 1);
    }
    const extras: [string, number][] = [["购物", 0.14], ["娱乐", 0.06], ["学习", 0.05], ["医疗", 0.04], ["人情", 0.03], ["宠物", 0.07], ["旅行", 0.01], ["其他", 0.04]];
    extras.forEach(([name, p]) => {
      if (rand() < p) {
        const pool = POOL[name];
        const item = pool[Math.floor(rand() * pool.length)];
        push(ds, name, item[1] + rand() * (item[2] - item[1]), item[0], [1, 2, 3][Math.floor(rand() * 3)]);
      }
    });
  }
  txs.sort((a, b) => (a.occurredOn < b.occurredOn ? 1 : a.occurredOn > b.occurredOn ? -1 : b.id - a.id));
}
seed();

/* ---------- 聚合 ---------- */

const inMonth = (t: Tx, m: string) => t.occurredOn.startsWith(m);
const sum = (list: Tx[], kind: string) =>
  list.filter((t) => t.kind === kind).reduce((s, t) => s + t.amount, 0);

function passed(month: string) {
  const total = daysInMonth(month);
  if (month !== thisMonth()) return total;
  return Math.min(new Date().getDate(), total);
}

function overview(month: string): Overview {
  const list = txs.filter((t) => inMonth(t, month));
  const prev = shiftMonth(month, -1);
  const d = passed(month);
  const prevExpense = txs
    .filter((t) => inMonth(t, prev) && t.kind === "expense" && Number(t.occurredOn.slice(8)) <= d)
    .reduce((s, t) => s + t.amount, 0);

  const dailyMap = new Map<number, number>();
  const catMap = new Map<number, number>();
  list.forEach((t) => {
    if (t.kind !== "expense") return;
    const day = Number(t.occurredOn.slice(8));
    dailyMap.set(day, (dailyMap.get(day) ?? 0) + t.amount);
    catMap.set(t.categoryId, (catMap.get(t.categoryId) ?? 0) + t.amount);
  });

  const daily: DayTotal[] = [...dailyMap.entries()]
    .map(([day, total]) => ({ day, total }))
    .sort((a, b) => a.day - b.day);
  const categories: CatTotal[] = [...catMap.entries()]
    .map(([categoryId, total]) => ({ categoryId, total }))
    .sort((a, b) => b.total - a.total);

  const budgetTotal = [...budgets.values()].reduce((s, v) => s + v, 0);
  const budgetUsed = [...catMap.entries()]
    .filter(([id]) => budgets.has(id))
    .reduce((s, [, v]) => s + v, 0);

  return {
    expense: sum(list, "expense"),
    income: sum(list, "income"),
    count: list.length,
    prevExpense,
    passedDays: d,
    daily,
    categories,
    recent: list.slice(0, 6),
    budgetTotal,
    budgetUsed,
  };
}

function accountRows(month: string): AccountRow[] {
  return ACCOUNTS.map((a) => {
    const list = txs.filter((t) => t.accountId === a.id);
    const balance = a.initialBalance + sum(list, "income") - sum(list, "expense");
    const m = list.filter((t) => inMonth(t, month));
    return {
      id: a.id,
      name: a.name,
      kind: a.kind,
      icon: a.icon,
      color: a.color,
      initialBalance: a.initialBalance,
      balance,
      monthExpense: sum(m, "expense"),
      monthIncome: sum(m, "income"),
      sortOrder: a.sortOrder,
    };
  });
}

/* ---------- 对外接口 ---------- */

export const mockApi = {
  bootstrap: async () => ({
    categories: CATEGORIES,
    accounts: accountRows(thisMonth()),
    today: todayStr(),
    month: thisMonth(),
    dbPath: "/mock/ledger.db",
  }),

  overview: async (month: string) => overview(month),

  flow: async (month: string, kind: string, query: string) => {
    const q = query.trim().toLowerCase();
    return txs.filter((t) => {
      if (!inMonth(t, month)) return false;
      if (kind !== "all" && t.kind !== kind) return false;
      if (!q) return true;
      const cat = CATEGORIES.find((c) => c.id === t.categoryId)?.name ?? "";
      return `${t.note} ${cat} ${(t.amount / 100).toFixed(2)}`.toLowerCase().includes(q);
    });
  },

  stats: async (month: string): Promise<StatsBundle> => {
    const ov = overview(month);
    const weekday = [0, 0, 0, 0, 0, 0, 0];
    const from = new Date();
    from.setDate(from.getDate() - 29);
    const fromStr = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;
    txs.forEach((t) => {
      if (t.kind !== "expense" || t.occurredOn < fromStr || t.occurredOn > todayStr()) return;
      weekday[weekdayIndex(t.occurredOn)] += t.amount;
    });
    const series: MonthPoint[] = [];
    for (let i = 5; i >= 0; i--) {
      const m = shiftMonth(month, -i);
      const list = txs.filter((t) => inMonth(t, m));
      series.push({ month: m, expense: sum(list, "expense"), income: sum(list, "income") });
    }
    return { expense: ov.expense, income: ov.income, categories: ov.categories, weekday, series };
  },

  budget: async (month: string): Promise<BudgetOverview> => {
    const ov = overview(month);
    const used = new Map(ov.categories.map((c) => [c.categoryId, c.total]));
    const rows: BudgetRow[] = CATEGORIES.filter((c) => c.kind === "expense").map((c) => ({
      categoryId: c.id,
      budget: budgets.get(c.id) ?? 0,
      used: used.get(c.id) ?? 0,
    }));
    return {
      total: rows.reduce((s, r) => s + r.budget, 0),
      used: rows.reduce((s, r) => s + r.used, 0),
      passedDays: passed(month),
      daysInMonth: daysInMonth(month),
      rows,
    };
  },

  accounts: async (month: string) => accountRows(month),

  create: async (input: TxInput) => {
    const id = nextId++;
    txs.unshift({ ...input, id, createdAt: Date.now() });
    return id;
  },

  update: async (id: number, input: TxInput) => {
    const i = txs.findIndex((t) => t.id === id);
    if (i >= 0) txs[i] = { ...txs[i], ...input };
  },

  remove: async (id: number) => {
    txs = txs.filter((t) => t.id !== id);
  },

  setBudget: async (categoryId: number, amount: number) => {
    budgets.set(categoryId, amount);
  },

  setBalance: async (id: number, balance: number) => {
    const row = accountRows(thisMonth()).find((a) => a.id === id);
    const acc = ACCOUNTS.find((a) => a.id === id);
    if (row && acc) acc.initialBalance += balance - row.balance;
  },

  exportCsv: async () => "/mock/墨账.csv|0",
  backup: async () => "/mock/backups/ledger-today.db",
};
