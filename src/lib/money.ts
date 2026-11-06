/** 金额一律用「分」在内部流转，只在渲染时格式化 */

/** "128.5" → 12850；非法输入返回 0 */
export function parseAmount(input: string): number {
  const clean = input.replace(/[^\d.]/g, "");
  const value = Number.parseFloat(clean);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 100);
}

/** 12850 → "128.50"（带千分位） */
export function fmt(cents: number, decimals = 2): string {
  const neg = cents < 0;
  const fixed = (Math.abs(cents) / 100).toFixed(decimals);
  const [int, dec] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (neg ? "-" : "") + (dec ? `${grouped}.${dec}` : grouped);
}

/** 只保留整数部分，用于图表刻度、预算这类不需要分的地方 */
export function fmtShort(cents: number): string {
  return fmt(cents, 0);
}

/** 拆出整数与小数，方便排版时弱化小数 */
export function splitAmount(cents: number): [string, string] {
  const s = fmt(cents);
  const i = s.lastIndexOf(".");
  return [s.slice(0, i), s.slice(i)];
}
