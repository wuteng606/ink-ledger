import { useState } from "react";
import { api } from "../lib/api";
import { fmt, fmtShort, parseAmount } from "../lib/money";
import { useAsync, useLedger } from "../lib/store";

const KIND_LABEL: Record<string, string> = {
  wallet: "电子钱包",
  bank: "储蓄卡",
  cash: "现金",
  credit: "信用卡",
};

export function Accounts() {
  const { month, version, touch, toast } = useLedger();
  const { data } = useAsync(() => api.accounts(month), [month, version]);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  if (!data) return <div className="empty">正在读取账户…</div>;

  const net = data.reduce((s, a) => s + a.balance, 0);

  const commit = async (id: number) => {
    const cents = parseAmount(draft);
    setEditing(null);
    if (cents <= 0) return;
    try {
      await api.setBalance(id, cents);
      touch();
      toast("余额已校准");
    } catch (e) {
      console.error(e);
      toast("校准失败");
    }
  };

  return (
    <div className="view">
      <div className="acc-grid">
        {data.map((a) => (
          <div className="acc-card" key={a.id}>
            <div className="acc-top">
              <div className="acc-ico" style={{ background: a.color }}>
                {a.icon}
              </div>
              <span className="acc-name">{a.name}</span>
              <span className="acc-type">{KIND_LABEL[a.kind] ?? a.kind}</span>
            </div>

            {editing === a.id ? (
              <input
                autoFocus
                value={draft}
                style={{
                  width: "100%",
                  height: 34,
                  background: "var(--field)",
                  color: "var(--tx)",
                  border: "1px solid var(--line-2)",
                  borderRadius: 8,
                  fontFamily: "var(--mono)",
                  fontSize: 18,
                  padding: "0 10px",
                  outline: "none",
                }}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => void commit(a.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void commit(a.id);
                  if (e.key === "Escape") setEditing(null);
                }}
              />
            ) : (
              <div
                className="acc-bal"
                style={{ cursor: "pointer" }}
                title="点击校准余额"
                onClick={() => {
                  setEditing(a.id);
                  setDraft((a.balance / 100).toFixed(2));
                }}
              >
                <small>¥</small>
                {fmt(a.balance)}
              </div>
            )}

            <div className="acc-foot">
              <span>
                本月支出 <b>¥{fmtShort(a.monthExpense)}</b>
              </span>
              <span>
                收入 <b>¥{fmtShort(a.monthIncome)}</b>
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <div className="p-head">
          <span className="p-title">净资产</span>
          <span className="p-note">含全部账户</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span
            style={{
              fontFamily: "var(--mono)",
              fontSize: 30,
              fontWeight: 620,
              letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            ¥ {fmt(net)}
          </span>
          <span style={{ fontSize: 11.5, color: "var(--tx-3)" }}>四个账户合计</span>
        </div>
        <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--tx-3)" }}>
          余额 = 初始余额 + 收入 − 支出；点数字可直接校准，改动只影响初始值，不会篡改历史流水
        </div>
      </div>
    </div>
  );
}
