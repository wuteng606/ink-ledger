use crate::db::{self, Account, AccountRow, BudgetOverview, Category, Db, MonthPoint, Overview, Tx};
use chrono::Local;
use serde::Serialize;
use tauri::{AppHandle, Manager, State};

fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Bootstrap {
    pub categories: Vec<Category>,
    pub accounts: Vec<Account>,
    pub today: String,
    pub month: String,
    pub db_path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatsBundle {
    pub expense: i64,
    pub income: i64,
    pub categories: Vec<db::CatTotal>,
    pub weekday: Vec<i64>,
    pub series: Vec<MonthPoint>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TxInput {
    pub kind: String,
    pub amount: i64,
    pub category_id: i64,
    pub account_id: i64,
    pub occurred_on: String,
    pub occurred_time: Option<String>,
    pub note: String,
}

#[tauri::command]
pub fn bootstrap(state: State<Db>) -> Result<Bootstrap, String> {
    let conn = state.0.lock().map_err(err)?;
    Ok(Bootstrap {
        categories: db::categories(&conn).map_err(err)?,
        accounts: db::accounts(&conn).map_err(err)?,
        today: db::today_str(),
        month: db::this_month(),
        db_path: db::meta_get(&conn, "db_path").unwrap_or_default(),
    })
}

#[tauri::command]
pub fn get_overview(state: State<Db>, month: String) -> Result<Overview, String> {
    let conn = state.0.lock().map_err(err)?;
    db::overview(&conn, &month).map_err(err)
}

#[tauri::command]
pub fn get_flow(
    state: State<Db>,
    month: String,
    kind: String,
    query: String,
) -> Result<Vec<Tx>, String> {
    let conn = state.0.lock().map_err(err)?;
    db::list_transactions(&conn, &month, &kind, &query).map_err(err)
}

#[tauri::command]
pub fn get_stats(state: State<Db>, month: String) -> Result<StatsBundle, String> {
    let conn = state.0.lock().map_err(err)?;
    let ov = db::overview(&conn, &month).map_err(err)?;
    Ok(StatsBundle {
        expense: ov.expense,
        income: ov.income,
        categories: ov.categories,
        weekday: db::weekday_totals(&conn, 30).map_err(err)?,
        series: db::month_series(&conn, &month, 6).map_err(err)?,
    })
}

#[tauri::command]
pub fn get_budget(state: State<Db>, month: String) -> Result<BudgetOverview, String> {
    let conn = state.0.lock().map_err(err)?;
    let rows = db::budget_rows(&conn, &month).map_err(err)?;
    let total = rows.iter().map(|r| r.budget).sum();
    let used = rows.iter().map(|r| r.used).sum();
    Ok(BudgetOverview {
        total,
        used,
        passed_days: month_days_passed(&month),
        days_in_month: month_days(&month),
        rows,
    })
}

#[tauri::command]
pub fn get_accounts(state: State<Db>, month: String) -> Result<Vec<AccountRow>, String> {
    let conn = state.0.lock().map_err(err)?;
    db::account_rows(&conn, &month).map_err(err)
}

#[tauri::command]
pub fn create_transaction(state: State<Db>, input: TxInput) -> Result<i64, String> {
    let conn = state.0.lock().map_err(err)?;
    db::create_tx(
        &conn,
        &input.kind,
        input.amount,
        input.category_id,
        input.account_id,
        &input.occurred_on,
        input.occurred_time.as_deref(),
        &input.note,
    )
    .map_err(err)
}

#[tauri::command]
pub fn update_transaction(state: State<Db>, id: i64, input: TxInput) -> Result<(), String> {
    let conn = state.0.lock().map_err(err)?;
    db::update_tx(
        &conn,
        id,
        &input.kind,
        input.amount,
        input.category_id,
        input.account_id,
        &input.occurred_on,
        input.occurred_time.as_deref(),
        &input.note,
    )
    .map_err(err)
}

#[tauri::command]
pub fn delete_transaction(state: State<Db>, id: i64) -> Result<(), String> {
    let conn = state.0.lock().map_err(err)?;
    db::delete_tx(&conn, id).map_err(err)
}

#[tauri::command]
pub fn set_budget(state: State<Db>, category_id: i64, amount: i64) -> Result<(), String> {
    let conn = state.0.lock().map_err(err)?;
    db::set_budget(&conn, category_id, amount).map_err(err)
}

#[tauri::command]
pub fn set_account_balance(state: State<Db>, id: i64, balance: i64) -> Result<(), String> {
    let conn = state.0.lock().map_err(err)?;
    db::set_account_balance(&conn, id, balance).map_err(err)
}

#[tauri::command]
pub fn export_csv(app: AppHandle, state: State<Db>) -> Result<String, String> {
    let dir = app
        .path()
        .download_dir()
        .or_else(|_| app.path().document_dir())
        .or_else(|_| app.path().app_data_dir())
        .map_err(err)?;
    let file = dir.join(format!("墨账-{}.csv", Local::now().format("%Y%m%d-%H%M")));
    let conn = state.0.lock().map_err(err)?;
    let n = db::export_csv(&conn, &file).map_err(err)?;
    Ok(format!("{}|{}", file.to_string_lossy(), n))
}

#[tauri::command]
pub fn backup_now(app: AppHandle, state: State<Db>) -> Result<String, String> {
    let dir = app.path().app_data_dir().map_err(err)?.join("backups");
    let conn = state.0.lock().map_err(err)?;
    db::backup_to(&conn, &dir).map_err(err)
}

fn month_days(month: &str) -> u32 {
    let y: i32 = month.get(0..4).and_then(|s| s.parse().ok()).unwrap_or(2026);
    let m: u32 = month.get(5..7).and_then(|s| s.parse().ok()).unwrap_or(1);
    let first = chrono::NaiveDate::from_ymd_opt(y, m, 1).unwrap();
    let (ny, nm) = if m == 12 { (y + 1, 1) } else { (y, m + 1) };
    let next = chrono::NaiveDate::from_ymd_opt(ny, nm, 1).unwrap();
    (next - first).num_days() as u32
}

fn month_days_passed(month: &str) -> u32 {
    use chrono::Datelike;
    let total = month_days(month);
    if month == Local::now().format("%Y-%m").to_string() {
        Local::now().day().min(total)
    } else {
        total
    }
}
