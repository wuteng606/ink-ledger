import { fmt } from "../lib/money";
import { useLedger } from "../lib/store";
import type { Tx } from "../lib/types";
import { IconTrash } from "./Icons";

interface Props {
  tx: Tx;
  onEdit?: (tx: Tx) => void;
  onDelete?: (tx: Tx) => void;
}

const hexAlpha = (hex: string, alpha: number) => {
  const h = hex.replace("#", "");
  if (h.length !== 6) return `rgba(138,147,163,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

export function FlowRow({ tx, onEdit, onDelete }: Props) {
  const { catMap, accounts } = useLedger();
  const cat = catMap.get(tx.categoryId);
  const acct = accounts.find((a) => a.id === tx.accountId);
  const sign = tx.kind === "income" ? "+" : "−";

  return (
    <div
      className="flow-item"
      onDoubleClick={() => onEdit?.(tx)}
      title={onEdit ? "双击修改" : undefined}
    >
      <div className="f-ico" style={{ background: hexAlpha(cat?.color ?? "#8a93a3", 0.15) }}>
        {cat?.icon ?? "🧾"}
      </div>
      <div className="f-main">
        <b>{tx.note || cat?.name || "未命名"}</b>
        <span>
          {cat?.name ?? "其他"} · {acct?.name ?? "—"} · {tx.occurredOn.slice(5).replace("-", "/")}
        </span>
      </div>
      {onDelete && (
        <button
          className="ibtn f-del"
          title="删除这笔"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(tx);
          }}
        >
          <IconTrash />
        </button>
      )}
      <div className={`f-amt ${tx.kind === "income" ? "inc" : "exp"}`}>
        {sign}¥{fmt(tx.amount)}
      </div>
    </div>
  );
}
