import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { fmt } from "../lib/money";
import { useAsync, useLedger } from "../lib/store";
import { dayLabel, weekdayCN } from "../lib/date";
import { FlowRow } from "../components/FlowRow";
import { IconSearch } from "../components/Icons";
import type { Kind, Tx } from "../lib/types";

interface Props {
  onEdit: (tx: Tx) => void;
}

type Filter = "all" | Kind;

export function Flow({ onEdit }: Props) {
  const { month, version, catMap, flowQuery, setFlowQuery, touch, toast } = useLedger();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState(flowQuery);

  // 侧边栏点分类会带关键词过来
  useEffect(() => {
    if (flowQuery) {
      setQuery(flowQuery);
      setFlowQuery("");
    }
  }, [flowQuery, setFlowQuery]);

  const { data } = useAsync(() => api.flow(month, "all", ""), [month, version]);

  const list = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.filter((t) => {
      if (filter !== "all" && t.kind !== filter) return false;
      if (!q) return true;
      const cat = catMap.get(t.categoryId)?.name ?? "";
      return `${t.note} ${cat} ${(t.amount / 100).toFixed(2)}`.toLowerCase().includes(q);
    });
  }, [data, filter, query, catMap]);

  const groups = useMemo(() => {
    const map = new Map<string, Tx[]>();
    list.forEach((t) => {
      const arr = map.get(t.occurredOn);
      if (arr) arr.push(t);
      else map.set(t.occurredOn, [t]);
    });
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [list]);

  const totalExp = list.filter((t) => t.kind === "expense").reduce((s, t) => s + t.amount, 0);
  const totalInc = list.filter((t) => t.kind === "income").reduce((s, t) => s + t.amount, 0);

  const remove = async (tx: Tx) => {
    try {
      await api.deleteTx(tx.id);
      touch();
      toast("已删除，可在导出里找回");
    } catch (e) {
      console.error(e);
      toast("删除失败");
    }
  };

  return (
    <div className="view">
      <div className="toolbar">
        <div className="search-box">
          <IconSearch />
          <input
            value={query}
            placeholder="搜备注、分类、金额…"
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="seg">
          {(["all", "expense", "income"] as Filter[]).map((f) => (
            <button
              key={f}
              className={filter === f ? "on" : ""}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "全部" : f === "expense" ? "支出" : "收入"}
            </button>
          ))}
        </div>
        <span className="p-note" style={{ marginLeft: "auto" }}>
          {list.length} 笔 · 支出 ¥{fmt(totalExp, 0)} · 收入 ¥{fmt(totalInc, 0)}
        </span>
      </div>

      {groups.length === 0 && (
        <div className="empty">
          <b>没有匹配的记录</b>
          换个关键词，或者切到别的月份看看
        </div>
      )}

      {groups.map(([date, rows]) => {
        const e = rows.filter((t) => t.kind === "expense").reduce((s, t) => s + t.amount, 0);
        const i = rows.filter((t) => t.kind === "income").reduce((s, t) => s + t.amount, 0);
        return (
          <div className="day-group" key={date}>
            <div className="day-head">
              <b>{dayLabel(date)}</b>
              <span>{weekdayCN(date)}</span>
              <span className="sum">
                {e > 0 && <span className="e">支出 ¥{fmt(e)}</span>}
                {i > 0 && <span className="i">收入 ¥{fmt(i)}</span>}
              </span>
            </div>
            <div className="flow-list">
              {rows.map((tx) => (
                <FlowRow key={tx.id} tx={tx} onEdit={onEdit} onDelete={remove} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
