import { useCallback, useEffect, useRef, useState } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { api } from "./lib/api";
import { fmt, parseAmount } from "./lib/money";
import { useLedger } from "./lib/store";
import { isTauri, win } from "./lib/window";
import type { Kind } from "./lib/types";

const notifyMain = () => {
  if (isTauri) void emit("ledger-changed");
};

export function QuickApp() {
  const { categories, accounts, today, toast } = useLedger();
  const [kind, setKind] = useState<Kind>("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(0);
  const [accountId, setAccountId] = useState(0);
  const [note, setNote] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const cats = categories.filter((c) => c.kind === kind);

  const reset = useCallback(() => {
    setKind("expense");
    setAmount("");
    setNote("");
    setCategoryId((prev) => (categories.find((c) => c.id === prev) ? prev : categories[0]?.id ?? 0));
    setAccountId((prev) => (accounts.find((a) => a.id === prev) ? prev : accounts[0]?.id ?? 0));
    inputRef.current?.focus();
  }, [categories, accounts]);

  // 每次窗口被唤起都清空重来
  useEffect(() => {
    if (!isTauri) {
      inputRef.current?.focus();
      return;
    }
    const p = listen("quick-focus", () => {
      reset();
      window.setTimeout(() => inputRef.current?.focus(), 60);
    });
    return () => {
      p.then((un) => un()).catch(() => undefined);
    };
  }, [reset]);

  // 默认值
  useEffect(() => {
    if (!categoryId && categories.length) {
      setCategoryId(categories.find((c) => c.kind === "expense")?.id ?? categories[0].id);
    }
    if (!accountId && accounts.length) setAccountId(accounts[0].id);
  }, [categories, accounts, categoryId, accountId]);

  // 切类型时修正分类
  useEffect(() => {
    if (cats.length && !cats.some((c) => c.id === categoryId)) {
      setCategoryId(cats[0].id);
    }
  }, [cats, categoryId]);

  const save = useCallback(async () => {
    const cents = parseAmount(amount);
    if (cents <= 0) {
      inputRef.current?.focus();
      return;
    }
    const cat = cats.find((c) => c.id === categoryId);
    try {
      await api.createTx({
        kind,
        amount: cents,
        categoryId,
        accountId,
        occurredOn: today,
        occurredTime: null,
        note: note.trim() || cat?.name || "",
      });
      notifyMain();
      toast(`已记录 ¥${fmt(cents)}`);
      setAmount("");
      setNote("");
      if (isTauri) win.hide();
    } catch (e) {
      console.error(e);
      toast("保存失败");
    }
  }, [amount, cats, categoryId, accountId, kind, note, today, toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (isTauri) win.hide();
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  return (
    <div className="quick-window">
      <div className="q-head" data-tauri-drag-region>
        <span className="q-brand" data-tauri-drag-region>
          记一笔
        </span>
        <div className="q-type">
          <button
            data-type="expense"
            className={kind === "expense" ? "on" : ""}
            onClick={() => setKind("expense")}
          >
            支出
          </button>
          <button
            data-type="income"
            className={kind === "income" ? "on" : ""}
            onClick={() => setKind("income")}
          >
            收入
          </button>
        </div>
      </div>

      <div className={`q-amount ${kind === "income" ? "inc" : ""}`}>
        <span className="cur">¥</span>
        <input
          ref={inputRef}
          value={amount}
          inputMode="decimal"
          placeholder="0.00"
          autoComplete="off"
          onChange={(e) =>
            setAmount(e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1"))
          }
        />
      </div>

      <div className="q-cats">
        {cats.map((c) => (
          <button
            key={c.id}
            className={`q-cat ${categoryId === c.id ? "on" : ""}`}
            onClick={() => setCategoryId(c.id)}
          >
            <span>{c.icon}</span>
            {c.name}
          </button>
        ))}
      </div>

      <div className="q-row">
        <select
          className="q-field"
          value={accountId}
          onChange={(e) => setAccountId(Number(e.target.value))}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <input
          className="q-field"
          value={note}
          placeholder="备注（可留空）"
          autoComplete="off"
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="q-foot">
        <span className="q-hint">↵ 保存 · Esc 关闭</span>
        <button className="q-save" onClick={() => void save()}>
          保存
        </button>
      </div>
    </div>
  );
}
