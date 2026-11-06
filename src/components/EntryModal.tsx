import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { fmt, parseAmount } from "../lib/money";
import { useLedger } from "../lib/store";
import type { Kind, Tx } from "../lib/types";
import { IconClose } from "./Icons";

interface Props {
  open: boolean;
  edit?: Tx | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EntryModal({ open, edit, onClose, onSaved }: Props) {
  const { categories, accounts, today, toast } = useLedger();
  const [kind, setKind] = useState<Kind>("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState(0);
  const [accountId, setAccountId] = useState(0);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const amountRef = useRef<HTMLInputElement>(null);

  const cats = useMemo(
    () => categories.filter((c) => c.kind === kind),
    [categories, kind]
  );

  // 打开时重置表单
  useEffect(() => {
    if (!open) return;
    if (edit) {
      setKind(edit.kind);
      setAmount((edit.amount / 100).toFixed(2));
      setCategoryId(edit.categoryId);
      setAccountId(edit.accountId);
      setDate(edit.occurredOn);
      setNote(edit.note);
    } else {
      setKind("expense");
      setAmount("");
      setCategoryId(categories.find((c) => c.kind === "expense")?.id ?? 0);
      setAccountId(accounts[0]?.id ?? 0);
      setDate(today);
      setNote("");
    }
    const t = window.setTimeout(() => amountRef.current?.focus(), 120);
    return () => window.clearTimeout(t);
  }, [open, edit, categories, accounts, today]);

  // 切换收支时，若当前分类不属于该类型就回落到第一个
  useEffect(() => {
    if (cats.length && !cats.some((c) => c.id === categoryId)) {
      setCategoryId(cats[0].id);
    }
  }, [cats, categoryId]);

  const save = useCallback(async () => {
    const cents = parseAmount(amount);
    if (cents <= 0) {
      amountRef.current?.focus();
      toast("先填个金额吧");
      return;
    }
    if (!categoryId || !accountId) {
      toast("分类和账户还没选");
      return;
    }
    const payload = {
      kind,
      amount: cents,
      categoryId,
      accountId,
      occurredOn: date,
      occurredTime: null,
      note: note.trim() || (cats.find((c) => c.id === categoryId)?.name ?? ""),
    };
    try {
      if (edit) {
        await api.updateTx(edit.id, payload);
      } else {
        await api.createTx(payload);
      }
      onSaved();
      onClose();
      toast(`${edit ? "已更新" : "已记录"} ¥${fmt(cents)} · ${cats.find((c) => c.id === categoryId)?.name ?? ""}`);
    } catch (e) {
      console.error(e);
      toast("保存失败，看一下控制台");
    }
  }, [amount, categoryId, accountId, kind, date, note, edit, cats, onSaved, onClose, toast]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, save]);

  return (
    <div
      className={`modal-mask ${open ? "show" : ""}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-label="记一笔">
        <div className="m-head">
          <span className="ttl">{edit ? "改一笔" : "记一笔"}</span>
          <div className="m-type">
            <button
              className={kind === "expense" ? "on" : ""}
              data-type="expense"
              onClick={() => setKind("expense")}
            >
              支出
            </button>
            <button
              className={kind === "income" ? "on" : ""}
              data-type="income"
              onClick={() => setKind("income")}
            >
              收入
            </button>
          </div>
          <button className="ibtn m-close" onClick={onClose} title="关闭">
            <IconClose />
          </button>
        </div>

        <div className="m-body">
          <div className={`amount-row ${kind === "income" ? "inc" : ""}`}>
            <span className="cur">¥</span>
            <input
              ref={amountRef}
              value={amount}
              inputMode="decimal"
              placeholder="0.00"
              autoComplete="off"
              onChange={(e) =>
                setAmount(
                  e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1")
                )
              }
            />
          </div>

          <div className="m-label">分类</div>
          <div className="cat-grid">
            {cats.map((c) => (
              <button
                key={c.id}
                className={`cat-btn ${categoryId === c.id ? "on" : ""}`}
                onClick={() => setCategoryId(c.id)}
              >
                <span className="ci">{c.icon}</span>
                {c.name}
              </button>
            ))}
          </div>

          <div className="m-row2">
            <label className="field">
              <span>账户</span>
              <select value={accountId} onChange={(e) => setAccountId(Number(e.target.value))}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>日期</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          </div>

          <label className="field" style={{ marginTop: 10 }}>
            <span>备注</span>
            <input
              type="text"
              value={note}
              placeholder="花在哪儿了？"
              autoComplete="off"
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
        </div>

        <div className="m-foot">
          <span className="hint">⌘ ↵ 保存</span>
          <button className="btn-ghost" onClick={onClose}>
            取消
          </button>
          <button className="btn-primary" onClick={() => void save()}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
