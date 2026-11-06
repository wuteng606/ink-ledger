use chrono::{Datelike, Local, NaiveDate};
use rusqlite::{params, Connection, Result};
use serde::Serialize;
use std::path::Path;
use std::sync::Mutex;

pub struct Db(pub Mutex<Connection>);

/* ============================================================
   数据结构（金额统一为「分」，i64）
   ============================================================ */

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: i64,
    pub name: String,
    pub kind: String,
    pub icon: String,
    pub color: String,
    pub sort_order: f64,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: i64,
    pub name: String,
    pub kind: String,
    pub icon: String,
    pub color: String,
    pub initial_balance: i64,
    pub balance: i64,
    pub sort_order: f64,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Tx {
    pub id: i64,
    pub kind: String,
    pub amount: i64,
    pub category_id: i64,
    pub account_id: i64,
    pub occurred_on: String,
    pub occurred_time: Option<String>,
    pub note: String,
    pub created_at: i64,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DayTotal {
    pub day: u32,
    pub total: i64,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CatTotal {
    pub category_id: i64,
    pub total: i64,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Overview {
    pub expense: i64,
    pub income: i64,
    pub count: i64,
    pub prev_expense: i64,
    pub passed_days: u32,
    pub daily: Vec<DayTotal>,
    pub categories: Vec<CatTotal>,
    pub recent: Vec<Tx>,
    pub budget_total: i64,
    pub budget_used: i64,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MonthPoint {
    pub month: String,
    pub expense: i64,
    pub income: i64,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BudgetRow {
    pub category_id: i64,
    pub budget: i64,
    pub used: i64,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AccountRow {
    pub id: i64,
    pub name: String,
    pub kind: String,
    pub icon: String,
    pub color: String,
    pub initial_balance: i64,
    pub balance: i64,
    pub month_expense: i64,
    pub month_income: i64,
    pub sort_order: f64,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BudgetOverview {
    pub total: i64,
    pub used: i64,
    pub passed_days: u32,
    pub days_in_month: u32,
    pub rows: Vec<BudgetRow>,
}

/* ============================================================
   工具
   ============================================================ */

pub fn today_str() -> String {
    Local::now().format("%Y-%m-%d").to_string()
}

pub fn this_month() -> String {
    Local::now().format("%Y-%m").to_string()
}

fn parse_month(month: &str) -> (i32, u32) {
    let y = month.get(0..4).and_then(|s| s.parse().ok()).unwrap_or(2026);
    let m = month.get(5..7).and_then(|s| s.parse().ok()).unwrap_or(1);
    (y, m)
}

fn days_in_month(month: &str) -> u32 {
    let (y, m) = parse_month(month);
    let first = NaiveDate::from_ymd_opt(y, m as u32, 1).unwrap_or_else(|| {
        NaiveDate::from_ymd_opt(2026, 1, 1).unwrap()
    });
    let (ny, nm) = if m == 12 { (y + 1, 1) } else { (y, m + 1) };
    let next = NaiveDate::from_ymd_opt(ny, nm, 1).unwrap_or(first);
    (next - first).num_days() as u32
}

/// 该月已经过去多少天（当月按今天算，历史月份按整月算）
fn passed_days(month: &str) -> u32 {
    if month == this_month() {
        Local::now().day().min(days_in_month(month))
    } else {
        days_in_month(month)
    }
}

fn shift_month(month: &str, delta: i32) -> String {
    let (y, m) = parse_month(month);
    let total = y * 12 + (m as i32 - 1) + delta;
    format!("{:04}-{:02}", total.div_euclid(12), total.rem_euclid(12) + 1)
}

fn row_to_tx(r: &rusqlite::Row) -> Result<Tx> {
    Ok(Tx {
        id: r.get(0)?,
        kind: r.get(1)?,
        amount: r.get(2)?,
        category_id: r.get(3)?,
        account_id: r.get(4)?,
        occurred_on: r.get(5)?,
        occurred_time: r.get(6)?,
        note: r.get(7)?,
        created_at: r.get(8)?,
    })
}

const TX_COLS: &str = "id, kind, amount, category_id, account_id, occurred_on, occurred_time, note, created_at";

/* ============================================================
   建表 + 种子
   ============================================================ */

pub fn open(path: &Path) -> Result<Connection> {
    let conn = Connection::open(path)?;
    let _ = conn.pragma_update(None, "journal_mode", "WAL");
    let _ = conn.pragma_update(None, "synchronous", "NORMAL");
    let _ = conn.pragma_update(None, "foreign_keys", "ON");

    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS accounts (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            name            TEXT    NOT NULL,
            kind            TEXT    NOT NULL DEFAULT 'wallet',
            icon            TEXT    NOT NULL DEFAULT '💳',
            color           TEXT    NOT NULL DEFAULT '#8a93a3',
            initial_balance INTEGER NOT NULL DEFAULT 0,
            sort_order      REAL    NOT NULL DEFAULT 0,
            archived        INTEGER NOT NULL DEFAULT 0,
            created_at      INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS categories (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT    NOT NULL,
            kind        TEXT    NOT NULL,
            icon        TEXT    NOT NULL DEFAULT '🧾',
            color       TEXT    NOT NULL DEFAULT '#8a93a3',
            parent_id   INTEGER,
            sort_order  REAL    NOT NULL DEFAULT 0,
            archived    INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS transactions (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            kind          TEXT    NOT NULL,
            amount        INTEGER NOT NULL,
            category_id   INTEGER NOT NULL REFERENCES categories(id),
            account_id    INTEGER NOT NULL REFERENCES accounts(id),
            occurred_on   TEXT    NOT NULL,
            occurred_time TEXT,
            note          TEXT    NOT NULL DEFAULT '',
            created_at    INTEGER NOT NULL,
            updated_at    INTEGER NOT NULL,
            deleted_at    INTEGER
        );

        CREATE TABLE IF NOT EXISTS budgets (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER NOT NULL,
            month       TEXT    NOT NULL DEFAULT 'default',
            amount      INTEGER NOT NULL,
            UNIQUE(category_id, month)
        );

        CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);

        CREATE INDEX IF NOT EXISTS idx_tx_date      ON transactions(occurred_on);
        CREATE INDEX IF NOT EXISTS idx_tx_cat_date  ON transactions(category_id, occurred_on);
        CREATE INDEX IF NOT EXISTS idx_tx_acct      ON transactions(account_id, occurred_on);
        CREATE INDEX IF NOT EXISTS idx_tx_live      ON transactions(deleted_at);
        "#,
    )?;

    Ok(conn)
}

pub fn seed_if_empty(conn: &Connection) -> Result<()> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM categories", [], |r| r.get(0))?;
    if count > 0 {
        return Ok(());
    }

    let accounts: [(&str, &str, &str, &str, i64); 4] = [
        ("微信零钱", "wallet", "💬", "#3fb96b", 234_060),
        ("支付宝", "wallet", "🅰", "#2f8fe0", 120_840),
        ("招商银行", "bank", "🏦", "#d04a45", 1_842_000),
        ("现金", "cash", "💵", "#8a93a3", 56_000),
    ];
    for (i, (name, kind, icon, color, bal)) in accounts.into_iter().enumerate() {
        conn.execute(
            "INSERT INTO accounts (name, kind, icon, color, initial_balance, sort_order, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![name, kind, icon, color, bal, (i as f64 + 1.0) * 100.0, 0],
        )?;
    }

    // (名称, 类型, 图标, 颜色)
    let cats: [(&str, &str, &str, &str); 18] = [
        ("餐饮", "expense", "🍜", "#f0975a"),
        ("交通", "expense", "🚇", "#5aa7f0"),
        ("购物", "expense", "🛍️", "#c48cf0"),
        ("居住", "expense", "🏠", "#6fc4a0"),
        ("娱乐", "expense", "🎬", "#f0c05a"),
        ("医疗", "expense", "💊", "#ef7b7b"),
        ("学习", "expense", "📚", "#7d8cf0"),
        ("账单", "expense", "💡", "#9aa4b6"),
        ("人情", "expense", "🎁", "#e88fb0"),
        ("宠物", "expense", "🐱", "#a58cf0"),
        ("旅行", "expense", "✈️", "#5ec4d6"),
        ("其他", "expense", "🧾", "#7b8494"),
        ("工资", "income", "💼", "#48cf9b"),
        ("奖金", "income", "🏆", "#f0a13a"),
        ("理财", "income", "📈", "#4ec3d3"),
        ("红包", "income", "🧧", "#ef6b7d"),
        ("报销", "income", "🧮", "#8fa3c0"),
        ("其他", "income", "➕", "#8a93a3"),
    ];
    for (i, (name, kind, icon, color)) in cats.into_iter().enumerate() {
        conn.execute(
            "INSERT INTO categories (name, kind, icon, color, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![name, kind, icon, color, (i as f64 + 1.0) * 100.0],
        )?;
    }

    // 默认月度预算（分）
    let budgets: [(&str, i64); 8] = [
        ("餐饮", 250_000),
        ("交通", 90_000),
        ("购物", 120_000),
        ("居住", 300_000),
        ("娱乐", 70_000),
        ("医疗", 30_000),
        ("学习", 40_000),
        ("账单", 50_000),
    ];
    for (name, amount) in budgets {
        conn.execute(
            "INSERT INTO budgets (category_id, month, amount)
             SELECT id, 'default', ?2 FROM categories WHERE name = ?1 AND kind = 'expense'",
            params![name, amount],
        )?;
    }

    conn.execute(
        "INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '1')",
        [],
    )?;

    Ok(())
}

/* ============================================================
   读取
   ============================================================ */

pub fn categories(conn: &Connection) -> Result<Vec<Category>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, kind, icon, color, sort_order FROM categories
         WHERE archived = 0 ORDER BY sort_order ASC",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(Category {
            id: r.get(0)?,
            name: r.get(1)?,
            kind: r.get(2)?,
            icon: r.get(3)?,
            color: r.get(4)?,
            sort_order: r.get(5)?,
        })
    })?;
    rows.collect()
}

pub fn accounts(conn: &Connection) -> Result<Vec<Account>> {
    let mut stmt = conn.prepare(
        "SELECT a.id, a.name, a.kind, a.icon, a.color, a.initial_balance,
                a.initial_balance
                  + COALESCE((SELECT SUM(CASE WHEN t.kind='income' THEN t.amount ELSE -t.amount END)
                              FROM transactions t
                              WHERE t.account_id = a.id AND t.deleted_at IS NULL), 0),
                a.sort_order
         FROM accounts a WHERE a.archived = 0 ORDER BY a.sort_order ASC",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(Account {
            id: r.get(0)?,
            name: r.get(1)?,
            kind: r.get(2)?,
            icon: r.get(3)?,
            color: r.get(4)?,
            initial_balance: r.get(5)?,
            balance: r.get(6)?,
            sort_order: r.get(7)?,
        })
    })?;
    rows.collect()
}

pub fn list_transactions(
    conn: &Connection,
    month: &str,
    kind: &str,
    query: &str,
) -> Result<Vec<Tx>> {
    let mut sql = format!(
        "SELECT {TX_COLS} FROM transactions
         WHERE deleted_at IS NULL AND occurred_on LIKE ?1"
    );
    if kind == "expense" || kind == "income" {
        sql.push_str(" AND kind = ?2");
    }
    if !query.trim().is_empty() {
        sql.push_str(" AND (note LIKE ?3 OR CAST(amount AS TEXT) LIKE ?3)");
    }
    sql.push_str(" ORDER BY occurred_on DESC, COALESCE(occurred_time, '') DESC, id DESC");

    let like_month = format!("{month}%");
    let like_q = format!("%{}%", query.trim());

    let mut stmt = conn.prepare(&sql)?;
    let rows = match (kind, query.trim().is_empty()) {
        ("expense", true) | ("income", true) => stmt
            .query_map(params![like_month, kind], row_to_tx)?
            .collect::<Result<Vec<Tx>>>()?,
        ("expense", false) | ("income", false) => stmt
            .query_map(params![like_month, kind, like_q], row_to_tx)?
            .collect::<Result<Vec<Tx>>>()?,
        (_, true) => stmt
            .query_map(params![like_month], row_to_tx)?
            .collect::<Result<Vec<Tx>>>()?,
        (_, false) => stmt
            .query_map(params![like_month, "", like_q], row_to_tx)?
            .collect::<Result<Vec<Tx>>>()?,
    };
    Ok(rows)
}

fn sum_kind(conn: &Connection, month: &str, kind: &str) -> Result<i64> {
    conn.query_row(
        "SELECT COALESCE(SUM(amount), 0) FROM transactions
         WHERE deleted_at IS NULL AND kind = ?2 AND occurred_on LIKE ?1",
        params![format!("{month}%"), kind],
        |r| r.get(0),
    )
}

/// 上月同期的支出（1 号 ~ 与本月相同的已过天数）
fn prev_same_period(conn: &Connection, month: &str) -> Result<i64> {
    let prev = shift_month(month, -1);
    let days = passed_days(month);
    let from = format!("{prev}-01");
    let to = format!("{prev}-{:02}", days.min(days_in_month(&prev)));
    conn.query_row(
        "SELECT COALESCE(SUM(amount), 0) FROM transactions
         WHERE deleted_at IS NULL AND kind = 'expense'
           AND occurred_on >= ?1 AND occurred_on <= ?2",
        params![from, to],
        |r| r.get(0),
    )
}

pub fn overview(conn: &Connection, month: &str) -> Result<Overview> {
    let expense = sum_kind(conn, month, "expense")?;
    let income = sum_kind(conn, month, "income")?;
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM transactions WHERE deleted_at IS NULL AND occurred_on LIKE ?1",
        params![format!("{month}%")],
        |r| r.get(0),
    )?;

    let mut daily: Vec<DayTotal> = Vec::new();
    {
        let mut stmt = conn.prepare(
            "SELECT CAST(substr(occurred_on, 9, 2) AS INTEGER) AS d, SUM(amount)
             FROM transactions
             WHERE deleted_at IS NULL AND kind = 'expense' AND occurred_on LIKE ?1
             GROUP BY d ORDER BY d",
        )?;
        let rows = stmt.query_map(params![format!("{month}%")], |r| {
            Ok(DayTotal {
                day: r.get(0)?,
                total: r.get(1)?,
            })
        })?;
        for item in rows {
            daily.push(item?);
        }
    }

    let mut cats: Vec<CatTotal> = Vec::new();
    {
        let mut stmt = conn.prepare(
            "SELECT category_id, SUM(amount) FROM transactions
             WHERE deleted_at IS NULL AND kind = 'expense' AND occurred_on LIKE ?1
             GROUP BY category_id ORDER BY SUM(amount) DESC",
        )?;
        let rows = stmt.query_map(params![format!("{month}%")], |r| {
            Ok(CatTotal {
                category_id: r.get(0)?,
                total: r.get(1)?,
            })
        })?;
        for item in rows {
            cats.push(item?);
        }
    }

    let mut recent: Vec<Tx> = Vec::new();
    {
        let mut stmt = conn.prepare(&format!(
            "SELECT {TX_COLS} FROM transactions
             WHERE deleted_at IS NULL AND occurred_on LIKE ?1
             ORDER BY occurred_on DESC, COALESCE(occurred_time, '') DESC, id DESC
             LIMIT 6"
        ))?;
        let rows = stmt.query_map(params![format!("{month}%")], row_to_tx)?;
        for item in rows {
            recent.push(item?);
        }
    }

    let budget_total: i64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0) FROM budgets WHERE month = 'default'",
        [],
        |r| r.get(0),
    )?;
    let budget_used: i64 = conn.query_row(
        "SELECT COALESCE(SUM(t.amount), 0) FROM transactions t
         JOIN budgets b ON b.category_id = t.category_id AND b.month = 'default'
         WHERE t.deleted_at IS NULL AND t.kind = 'expense' AND t.occurred_on LIKE ?1",
        params![format!("{month}%")],
        |r| r.get(0),
    )?;

    Ok(Overview {
        expense,
        income,
        count,
        prev_expense: prev_same_period(conn, month)?,
        passed_days: passed_days(month),
        daily,
        categories: cats,
        recent,
        budget_total,
        budget_used,
    })
}

pub fn month_series(conn: &Connection, end_month: &str, n: i32) -> Result<Vec<MonthPoint>> {
    let mut out = Vec::new();
    for i in (0..n).rev() {
        let m = shift_month(end_month, -i);
        out.push(MonthPoint {
            expense: sum_kind(conn, &m, "expense")?,
            income: sum_kind(conn, &m, "income")?,
            month: m,
        });
    }
    Ok(out)
}

/// 最近 `days` 天按周几汇总（0 = 周日）
pub fn weekday_totals(conn: &Connection, days: i64) -> Result<Vec<i64>> {
    let today = Local::now().date_naive();
    let start = today - chrono::Duration::days(days - 1);
    let from = start.format("%Y-%m-%d").to_string();
    let to = today.format("%Y-%m-%d").to_string();

    let mut out = vec![0i64; 7];
    let mut stmt = conn.prepare(
        "SELECT occurred_on, SUM(amount) FROM transactions
         WHERE deleted_at IS NULL AND kind = 'expense'
           AND occurred_on >= ?1 AND occurred_on <= ?2
         GROUP BY occurred_on",
    )?;
    let rows = stmt.query_map(params![from, to], |r| {
        Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?))
    })?;
    for item in rows {
        let (date, total) = item?;
        if let Ok(d) = NaiveDate::parse_from_str(&date, "%Y-%m-%d") {
            let idx = d.weekday().num_days_from_sunday() as usize;
            out[idx] += total;
        }
    }
    Ok(out)
}

pub fn budget_rows(conn: &Connection, month: &str) -> Result<Vec<BudgetRow>> {
    let mut stmt = conn.prepare(
        "SELECT c.id,
                COALESCE(b.amount, 0),
                COALESCE((SELECT SUM(t.amount) FROM transactions t
                          WHERE t.category_id = c.id AND t.deleted_at IS NULL
                            AND t.kind = 'expense' AND t.occurred_on LIKE ?1), 0)
         FROM categories c
         LEFT JOIN budgets b ON b.category_id = c.id AND b.month = 'default'
         WHERE c.kind = 'expense' AND c.archived = 0
         ORDER BY c.sort_order",
    )?;
    let rows = stmt.query_map(params![format!("{month}%")], |r| {
        Ok(BudgetRow {
            category_id: r.get(0)?,
            budget: r.get(1)?,
            used: r.get(2)?,
        })
    })?;
    rows.collect()
}

pub fn account_rows(conn: &Connection, month: &str) -> Result<Vec<AccountRow>> {
    let mut stmt = conn.prepare(
        "SELECT a.id, a.name, a.kind, a.icon, a.color, a.initial_balance,
                a.initial_balance
                  + COALESCE((SELECT SUM(CASE WHEN t.kind='income' THEN t.amount ELSE -t.amount END)
                              FROM transactions t
                              WHERE t.account_id = a.id AND t.deleted_at IS NULL), 0),
                COALESCE((SELECT SUM(t.amount) FROM transactions t
                          WHERE t.account_id = a.id AND t.deleted_at IS NULL
                            AND t.kind='expense' AND t.occurred_on LIKE ?1), 0),
                COALESCE((SELECT SUM(t.amount) FROM transactions t
                          WHERE t.account_id = a.id AND t.deleted_at IS NULL
                            AND t.kind='income' AND t.occurred_on LIKE ?1), 0),
                a.sort_order
         FROM accounts a WHERE a.archived = 0 ORDER BY a.sort_order",
    )?;
    let rows = stmt.query_map(params![format!("{month}%")], |r| {
        Ok(AccountRow {
            id: r.get(0)?,
            name: r.get(1)?,
            kind: r.get(2)?,
            icon: r.get(3)?,
            color: r.get(4)?,
            initial_balance: r.get(5)?,
            balance: r.get(6)?,
            month_expense: r.get(7)?,
            month_income: r.get(8)?,
            sort_order: r.get(9)?,
        })
    })?;
    rows.collect()
}

/* ============================================================
   写入
   ============================================================ */

pub fn create_tx(
    conn: &Connection,
    kind: &str,
    amount: i64,
    category_id: i64,
    account_id: i64,
    occurred_on: &str,
    occurred_time: Option<&str>,
    note: &str,
) -> Result<i64> {
    let now = Local::now().timestamp_millis();
    conn.execute(
        "INSERT INTO transactions
            (kind, amount, category_id, account_id, occurred_on, occurred_time, note, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
        params![kind, amount, category_id, account_id, occurred_on, occurred_time, note, now],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn update_tx(
    conn: &Connection,
    id: i64,
    kind: &str,
    amount: i64,
    category_id: i64,
    account_id: i64,
    occurred_on: &str,
    occurred_time: Option<&str>,
    note: &str,
) -> Result<()> {
    let now = Local::now().timestamp_millis();
    conn.execute(
        "UPDATE transactions SET kind = ?1, amount = ?2, category_id = ?3, account_id = ?4,
                occurred_on = ?5, occurred_time = ?6, note = ?7, updated_at = ?8
         WHERE id = ?9",
        params![kind, amount, category_id, account_id, occurred_on, occurred_time, note, now, id],
    )?;
    Ok(())
}

pub fn delete_tx(conn: &Connection, id: i64) -> Result<()> {
    let now = Local::now().timestamp_millis();
    conn.execute(
        "UPDATE transactions SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2",
        params![now, id],
    )?;
    Ok(())
}

pub fn set_budget(conn: &Connection, category_id: i64, amount: i64) -> Result<()> {
    conn.execute(
        "INSERT INTO budgets (category_id, month, amount) VALUES (?1, 'default', ?2)
         ON CONFLICT(category_id, month) DO UPDATE SET amount = excluded.amount",
        params![category_id, amount],
    )?;
    Ok(())
}

pub fn set_account_balance(conn: &Connection, id: i64, balance: i64) -> Result<()> {
    // 不改历史流水：把差额落到「初始余额」上，保证余额口径可解释
    let current: i64 = conn.query_row(
        "SELECT a.initial_balance
                + COALESCE((SELECT SUM(CASE WHEN t.kind='income' THEN t.amount ELSE -t.amount END)
                            FROM transactions t WHERE t.account_id = a.id AND t.deleted_at IS NULL), 0)
         FROM accounts a WHERE a.id = ?1",
        params![id],
        |r| r.get(0),
    )?;
    let diff = balance - current;
    conn.execute(
        "UPDATE accounts SET initial_balance = initial_balance + ?1 WHERE id = ?2",
        params![diff, id],
    )?;
    Ok(())
}

/* ============================================================
   导出 / 备份
   ============================================================ */

pub fn export_csv(conn: &Connection, path: &Path) -> Result<usize> {
    let mut stmt = conn.prepare(
        "SELECT t.occurred_on, COALESCE(t.occurred_time, ''), t.kind, t.amount,
                c.name, a.name, t.note
         FROM transactions t
         JOIN categories c ON c.id = t.category_id
         JOIN accounts a ON a.id = t.account_id
         WHERE t.deleted_at IS NULL
         ORDER BY t.occurred_on DESC, t.id DESC",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, String>(2)?,
            r.get::<_, i64>(3)?,
            r.get::<_, String>(4)?,
            r.get::<_, String>(5)?,
            r.get::<_, String>(6)?,
        ))
    })?;

    // BOM 让 Excel 直接按 UTF-8 打开
    let mut out = String::from("\u{feff}日期,时间,类型,金额,分类,账户,备注\n");
    let mut n = 0usize;
    for row in rows {
        let (date, time, kind, amount, cat, acct, note) = row?;
        out.push_str(&format!(
            "{},{},{},{:.2},{},{},{}\n",
            date,
            time,
            if kind == "income" { "收入" } else { "支出" },
            amount as f64 / 100.0,
            escape_csv(&cat),
            escape_csv(&acct),
            escape_csv(&note)
        ));
        n += 1;
    }
    std::fs::write(path, out).map_err(|e| {
        rusqlite::Error::SqliteFailure(
            rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_ERROR),
            Some(e.to_string()),
        )
    })?;
    Ok(n)
}

fn escape_csv(s: &str) -> String {
    if s.contains(',') || s.contains('"') || s.contains('\n') {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}

pub fn backup_to(conn: &Connection, dir: &Path) -> Result<String> {
    std::fs::create_dir_all(dir).ok();
    let name = format!("ledger-{}.db", Local::now().format("%Y-%m-%d"));
    let target = dir.join(&name);

    let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE)");
    let mut dst = Connection::open(&target)?;
    {
        let backup = rusqlite::backup::Backup::new(conn, &mut dst)?;
        backup.run_to_completion(32, std::time::Duration::from_millis(10), None)?;
    }
    let _ = dst.close();

    // 只保留最近 14 份
    if let Ok(entries) = std::fs::read_dir(dir) {
        let mut files: Vec<_> = entries
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().starts_with("ledger-"))
            .collect();
        files.sort_by_key(|e| e.file_name());
        if files.len() > 14 {
            for f in &files[..files.len() - 14] {
                let _ = std::fs::remove_file(f.path());
            }
        }
    }

    Ok(target.to_string_lossy().to_string())
}

pub fn meta_get(conn: &Connection, key: &str) -> Option<String> {
    conn.query_row("SELECT value FROM meta WHERE key = ?1", params![key], |r| {
        r.get(0)
    })
    .ok()
}

pub fn meta_set(conn: &Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO meta (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}

/* ============================================================
   测试
   ============================================================ */

#[cfg(test)]
mod tests {
    use super::*;

    fn mem() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
              kind TEXT NOT NULL DEFAULT 'wallet', icon TEXT NOT NULL DEFAULT 'x',
              color TEXT NOT NULL DEFAULT '#fff', initial_balance INTEGER NOT NULL DEFAULT 0,
              sort_order REAL NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0,
              created_at INTEGER NOT NULL DEFAULT 0);
            CREATE TABLE categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
              kind TEXT NOT NULL, icon TEXT NOT NULL DEFAULT 'x', color TEXT NOT NULL DEFAULT '#fff',
              parent_id INTEGER, sort_order REAL NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0);
            CREATE TABLE transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL,
              amount INTEGER NOT NULL, category_id INTEGER NOT NULL, account_id INTEGER NOT NULL,
              occurred_on TEXT NOT NULL, occurred_time TEXT, note TEXT NOT NULL DEFAULT '',
              created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER);
            CREATE TABLE budgets (id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER NOT NULL,
              month TEXT NOT NULL DEFAULT 'default', amount INTEGER NOT NULL,
              UNIQUE(category_id, month));
            CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
            "#,
        )
        .unwrap();
        seed_if_empty(&conn).unwrap();
        conn
    }

    #[test]
    fn seeds_categories_and_accounts() {
        let conn = mem();
        assert_eq!(categories(&conn).unwrap().len(), 18);
        assert_eq!(accounts(&conn).unwrap().len(), 4);
        assert_eq!(budget_rows(&conn, "2026-11").unwrap().len(), 12);
    }

    #[test]
    fn amounts_are_integer_cents() {
        let conn = mem();
        let food = categories(&conn)
            .unwrap()
            .into_iter()
            .find(|c| c.name == "餐饮" && c.kind == "expense")
            .unwrap();
        create_tx(&conn, "expense", 3_856_00, food.id, 1, "2026-11-06", Some("12:30"), "面").unwrap();
        let ov = overview(&conn, "2026-11").unwrap();
        assert_eq!(ov.expense, 385_600);
        assert_eq!(ov.daily.len(), 1);
        assert_eq!(ov.daily[0].total, 385_600);
    }

    #[test]
    fn deleted_tx_disappears_from_totals() {
        let conn = mem();
        let cat = categories(&conn).unwrap()[0].id;
        let id = create_tx(&conn, "expense", 1_000, cat, 1, "2026-11-05", None, "x").unwrap();
        assert_eq!(overview(&conn, "2026-11").unwrap().expense, 1_000);
        delete_tx(&conn, id).unwrap();
        assert_eq!(overview(&conn, "2026-11").unwrap().expense, 0);
        assert_eq!(list_transactions(&conn, "2026-11", "all", "").unwrap().len(), 0);
    }

    #[test]
    fn balance_follows_transactions() {
        let conn = mem();
        let cat = categories(&conn).unwrap()[0].id;
        let before = accounts(&conn).unwrap()[0].balance;
        create_tx(&conn, "expense", 20_000, cat, 1, "2026-11-01", None, "花").unwrap();
        create_tx(&conn, "income", 50_000, cat, 1, "2026-11-02", None, "赚").unwrap();
        assert_eq!(accounts(&conn).unwrap()[0].balance, before + 30_000);
    }

    #[test]
    fn search_filters_by_note() {
        let conn = mem();
        let cat = categories(&conn).unwrap()[0].id;
        create_tx(&conn, "expense", 1_200, cat, 1, "2026-11-03", None, "楼下牛肉面").unwrap();
        create_tx(&conn, "expense", 800, cat, 1, "2026-11-03", None, "地铁").unwrap();
        assert_eq!(list_transactions(&conn, "2026-11", "all", "牛肉").unwrap().len(), 1);
        assert_eq!(list_transactions(&conn, "2026-11", "all", "").unwrap().len(), 2);
    }

    #[test]
    fn overview_splits_days_and_categories() {
        let conn = mem();
        let cats = categories(&conn).unwrap();
        let food = cats.iter().find(|c| c.name == "餐饮").unwrap().id;
        let traffic = cats.iter().find(|c| c.name == "交通").unwrap().id;
        create_tx(&conn, "expense", 5_000, food, 1, "2026-11-03", None, "面").unwrap();
        create_tx(&conn, "expense", 3_000, food, 1, "2026-11-03", None, "饭").unwrap();
        create_tx(&conn, "expense", 2_000, traffic, 1, "2026-11-05", None, "地铁").unwrap();
        create_tx(&conn, "income", 900_000, food, 1, "2026-11-05", None, "工资").unwrap();

        let ov = overview(&conn, "2026-11").unwrap();
        assert_eq!(ov.expense, 10_000);
        assert_eq!(ov.income, 900_000);
        assert_eq!(ov.count, 4);
        assert_eq!(ov.daily.len(), 2);
        assert_eq!(ov.daily[0].day, 3);
        assert_eq!(ov.daily[0].total, 8_000);
        assert_eq!(ov.categories[0].category_id, food);
        assert_eq!(ov.categories[0].total, 8_000);
        assert_eq!(ov.recent.len(), 4);
    }

    #[test]
    fn budget_rows_pair_defaults_with_usage() {
        let conn = mem();
        let cats = categories(&conn).unwrap();
        let food = cats.iter().find(|c| c.name == "餐饮").unwrap().id;
        create_tx(&conn, "expense", 120_000, food, 1, "2026-11-02", None, "聚餐").unwrap();

        let rows = budget_rows(&conn, "2026-11").unwrap();
        let food_row = rows.iter().find(|r| r.category_id == food).unwrap();
        assert_eq!(food_row.budget, 250_000);
        assert_eq!(food_row.used, 120_000);
        assert_eq!(rows.len(), 12);
    }

    #[test]
    fn account_rows_track_month_flow() {
        let conn = mem();
        let cat = categories(&conn).unwrap()[0].id;
        create_tx(&conn, "expense", 10_000, cat, 1, "2026-11-02", None, "花").unwrap();
        create_tx(&conn, "income", 30_000, cat, 1, "2026-11-03", None, "收").unwrap();
        let rows = account_rows(&conn, "2026-11").unwrap();
        let first = &rows[0];
        assert_eq!(first.month_expense, 10_000);
        assert_eq!(first.month_income, 30_000);
        assert_eq!(first.balance, first.initial_balance + 20_000);
    }

    #[test]
    fn series_covers_requested_months() {
        let conn = mem();
        let cat = categories(&conn).unwrap()[0].id;
        create_tx(&conn, "expense", 1_000, cat, 1, "2026-09-15", None, "a").unwrap();
        create_tx(&conn, "expense", 2_000, cat, 1, "2026-11-01", None, "b").unwrap();
        let s = month_series(&conn, "2026-11", 3).unwrap();
        assert_eq!(s.len(), 3);
        assert_eq!(s[0].month, "2026-09");
        assert_eq!(s[0].expense, 1_000);
        assert_eq!(s[2].month, "2026-11");
        assert_eq!(s[2].expense, 2_000);
    }

    #[test]
    fn month_shift_crosses_year() {
        assert_eq!(shift_month("2026-01", -1), "2025-12");
        assert_eq!(shift_month("2026-12", 1), "2027-01");
        assert_eq!(days_in_month("2026-02"), 28);
        assert_eq!(days_in_month("2024-02"), 29);
    }
}
