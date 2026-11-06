# 墨账 Ink Ledger · 技术方案（待确认）

> 目标：Mac 桌面端、单机、无账号、打开即记的记账小工具。首版只做「记清楚自己的钱」，不做云同步、多账本、投资记账。
> 设计稿：`design/ui-preview.html`（浏览器直接打开，可交互试玩）

## 一、技术选型

### 候选对比

| 维度 | Tauri 2（推荐） | Electron | SwiftUI 原生 |
| --- | --- | --- | --- |
| 安装包体积 | 约 6–9 MB | 约 90–130 MB | 约 3–6 MB |
| 冷启动 | 快（系统 WebView） | 较慢（自带 Chromium） | 最快 |
| 内存占用 | 约 70–120 MB | 约 180–300 MB | 约 30–60 MB |
| 图表能力 | 高（SVG / Canvas 随便画） | 高 | 中（Charts 框架受限） |
| 本机条件 | ✅ Rust 1.89 + CLT 就绪 | ✅ Node 22 | ❌ 未装 Xcode |
| 与已有工具一致性 | ✅ 和 file-shelf / mini-todo 同一套构建脚本 | ❌ 另起一套 | ❌ 另起一套 |

**结论：Tauri 2。** 和工作区里已有的两个工具同壳，构建、打包、图标流程可以整段复用，不新增工具链成本。

### 最终技术栈

- **壳**：Tauri 2（Rust 1.89，macOS WKWebView）
- **前端**：React 19 + TypeScript + Vite + 原生 CSS 变量（设计稿的 token 直接落地）
- **状态**：Zustand（三个 store：`ledger` / `ui` / `draft`）
- **数据**：SQLite + `rusqlite`（bundled），库文件放 `~/Library/Application Support/InkLedger/ledger.db`
- **图表**：Hand-rolled SVG（柱状 / 环形都不复杂，不引 ECharts，省 300 KB 和一层 API）
- **Tauri 插件**：`global-shortcut`、`positioner`、`store`、`single-instance`、`autostart`、`dialog`、`fs`
- **日期**：`dayjs` + `zh-cn` locale（只为了格式化，不做时区换算）

## 二、架构分层

```
src-tauri/
  src/main.rs        启动、单实例、托盘、窗口装配
  src/db.rs          建表、迁移、连接池
  src/commands.rs    IPC：transactions / stats / budgets / accounts / export
  src/backup.rs      每日快照、手动导出
  src/tray.rs        菜单栏图标

src/
  main/              主窗口入口（1180×860，可缩放）
  quick/             快速记账浮窗入口（420×300，无边框）
  components/        StatCard、TrendBars、DonutChart、FlowRow、BudgetBar、QuickAdd
  pages/             Overview、Flow、Stats、Budget、Accounts
  stores/            ledger.ts、ui.ts、draft.ts
  lib/               ipc.ts、money.ts、date.ts、csv.ts
  styles/            tokens.css（深浅两套变量）、app.css
```

**两个窗口共用数据层**：主窗口负责浏览与分析，全局快捷键 `⌥⌘N` 唤起快速记账浮窗（贴在菜单栏图标下方），只保留「金额 → 分类 → 回车」三步，不打断当前工作。

## 三、数据模型

金额一律用 **INTEGER 存「分」**，前端只在渲染时除以 100 —— 浮点数在求和时会漂，记账工具不能有这个问题。

```sql
accounts(
  id, name, type,            -- wallet / bank / cash / credit
  icon, color,
  initial_balance,           -- 分
  sort_order, archived, created_at
)

categories(
  id, name, kind,            -- expense / income
  icon, color,
  parent_id,                 -- 预留二级分类
  sort_order, archived
)

transactions(
  id, kind,                  -- expense / income
  amount,                    -- 分，恒为正数，方向由 kind 决定
  category_id, account_id,
  occurred_on,               -- 'YYYY-MM-DD'（本地日期，按月查询直接 substr 比较）
  occurred_time,             -- 'HH:mm'，可空
  note,
  created_at, updated_at, deleted_at
)

budgets(id, category_id, month, amount)   -- month = 'YYYY-MM'，amount 为分
meta(key, value)                          -- schema_version / last_backup_at
```

索引：

```sql
CREATE INDEX idx_tx_date     ON transactions(occurred_on);
CREATE INDEX idx_tx_cat_date ON transactions(category_id, occurred_on);
CREATE INDEX idx_tx_acct     ON transactions(account_id, occurred_on);
```

- **软删除**：`deleted_at`，撤销 5 秒内可回滚，30 天后清理；
- **余额是派生值**：`initial_balance + Σ收入 − Σ支出`，账户页显示派生余额；用户可「校准」写入一条 adjustment 流水，不直接改余额；
- **分类删除**走 `archived`，历史流水仍能显示原分类名。

## 四、关键实现

### 1. 统计查询

数据量按 10 年、每天 5 笔算约 1.8 万行，直接 SQL 聚合即可，不做缓存表。

```sql
-- 某月分类支出
SELECT category_id, SUM(amount) AS total
FROM transactions
WHERE deleted_at IS NULL AND kind = 'expense'
  AND occurred_on LIKE '2026-11%'
GROUP BY category_id ORDER BY total DESC;

-- 近 6 个月收支
SELECT substr(occurred_on,1,7) AS m,
       SUM(CASE WHEN kind='expense' THEN amount ELSE 0 END) AS exp,
       SUM(CASE WHEN kind='income'  THEN amount ELSE 0 END) AS inc
FROM transactions WHERE deleted_at IS NULL
GROUP BY m ORDER BY m DESC LIMIT 6;
```

流水列表超过 300 条时接 `@tanstack/react-virtual`，首屏只渲染可视区。

### 2. 快速记账浮窗

- 无边框 + `transparent` + `alwaysOnTop`，失焦自动隐藏（`onFocusChanged`）；
- 金额输入框自动聚焦，全选；`Esc` 关闭，`⌘↵` 保存；
- 记住上一次用的账户与分类作为默认值；
- 保存后不关闭，显示 1.2 秒打卡动画再收起，方便连续记多笔。

### 3. 导入导出

- **导出**：CSV（UTF-8 BOM，Excel 直接打开不乱码）+ JSON 全量备份；
- **导入**（v0.2）：支持微信 / 支付宝账单 CSV，按表头特征自动识别列，导入前给出「识别到 128 条，日期范围 X–Y，合计 ¥Z」的预览，确认后写入并打上 `imported` 标记，便于整批撤销。

### 4. 备份

- 每日首次启动时生成 `backups/ledger-YYYY-MM-DD.db`，保留最近 14 份；
- 写入前先 WAL checkpoint，避免备份到半写状态；
- 设置页可「导出全部数据」为单个 `.inkledger` 文件（zip：db + json 清单）。

## 五、功能范围

**v0.1（首版）**
- 记一笔：金额、分类、账户、日期、备注；支持改与删
- 流水：按月查看、按日分组、关键词搜索、支出/收入筛选
- 概览：四个指标卡、每日柱状图、分类环图、最近流水、预算余量
- 统计：分类排行、一周节律、近 6 个月收支对比
- 预算：月度分类预算 + 进度预警（80% 黄 / 100% 红）
- 账户：四个默认账户，余额与本月收支
- 全局快捷键 + 菜单栏图标 + 每日备份 + CSV 导出

**v0.2（确认后再排）**
- 微信/支付宝账单导入
- 周期账单自动生成（房租、订阅、还款）
- 多账本（个人 / 家庭 / 副业）
- Touch ID 密码锁
- 菜单栏常驻显示本月结余

**明确不做**：云同步、账号体系、多人协作、投资持仓管理。

## 六、里程碑

| 阶段 | 内容 | 产出 |
| --- | --- | --- |
| M1 | 项目骨架、DB 建表与迁移、IPC 打通 | 能跑 `tauri dev`，能存一条流水 |
| M2 | 记一笔弹窗 + 流水页 | 核心闭环可用 |
| M3 | 概览 / 统计 / 预算 / 账户四页 | 设计稿 1:1 还原 |
| M4 | 快速记账浮窗 + 托盘 + 备份 | 桌面形态完整 |
| M5 | 图标、打包、README、`index.html` 索引更新 | `墨账.app` 可双击运行 |

## 七、待你确认

1. **分类够不够**：现在是 12 个支出 + 6 个收入，要不要加减？（支出：餐饮/交通/购物/居住/娱乐/医疗/学习/账单/人情/宠物/旅行/其他）
2. **账户**：默认给微信、支付宝、招商银行、现金四个，需要增减吗？
3. **预算**：首版只做「月度 + 按分类」够用吗，要不要做「年度」或「自定义周期」？
4. **周期账单**（房租自动记账）放 v0.2 可以接受吗？
5. **配色**：默认深色还是跟随系统？预览稿里点右上角太阳图标可以切浅色，两套都做了。
