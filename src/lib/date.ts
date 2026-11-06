const WD = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** "2026-11" → "2026 年 11 月" */
export function monthLabel(month: string): string {
  return `${month.slice(0, 4)} 年 ${Number(month.slice(5, 7))} 月`;
}

export function shiftMonth(month: string, delta: number): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1 + delta;
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function daysInMonth(month: string): number {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return new Date(y, m, 0).getDate();
}

export function weekdayCN(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return WD[new Date(y, m - 1, d).getDay()];
}

export function weekdayShort(dateStr: string): string {
  return weekdayCN(dateStr).replace("周", "");
}

/** "2026-11-06" → "11 月 06 日" */
export function dayLabel(dateStr: string): string {
  return `${Number(dateStr.slice(5, 7))} 月 ${dateStr.slice(8, 10)} 日`;
}

/** 一周里第几天（0 = 周日） */
export function weekdayIndex(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
