use sqlx::{SqlitePool, sqlite::SqlitePoolOptions};
use tauri::Manager;

pub async fn init_db(app: &tauri::App) -> Result<SqlitePool, Box<dyn std::error::Error>> {
    // Store the database in the app data directory
    let app_dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&app_dir)?;
    let db_path = app_dir.join("graphtask.db");
    let db_url = format!("sqlite://{}?mode=rwc", db_path.to_string_lossy());

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await?;

    run_migrations(&pool).await?;

    Ok(pool)
}

async fn run_migrations(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query("PRAGMA foreign_keys = ON").execute(pool).await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS graph (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            created_at  TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
        )"
    ).execute(pool).await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS task (
            id          TEXT PRIMARY KEY,
            graph_id    TEXT NOT NULL REFERENCES graph(id) ON DELETE CASCADE,
            title       TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            status      TEXT NOT NULL DEFAULT 'todo',
            position    REAL NOT NULL DEFAULT 0,
            created_at  TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
        )"
    ).execute(pool).await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS edge (
            id          TEXT PRIMARY KEY,
            graph_id    TEXT NOT NULL REFERENCES graph(id) ON DELETE CASCADE,
            source_id   TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
            target_id   TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
            UNIQUE(source_id, target_id)
        )"
    ).execute(pool).await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS task_resource (
            id        TEXT PRIMARY KEY,
            task_id   TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
            label     TEXT NOT NULL,
            url       TEXT NOT NULL,
            kind      TEXT NOT NULL DEFAULT 'link'
        )"
    ).execute(pool).await?;

    Ok(())
}
