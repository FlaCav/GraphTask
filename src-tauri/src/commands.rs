use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;
use chrono::Utc;
use crate::models::{Graph, Task, Edge, TaskResource};

fn now() -> String {
    Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
}

// ── Graph commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn create_graph(
    pool: State<'_, SqlitePool>,
    name: String,
) -> Result<Graph, String> {
    let id = Uuid::new_v4().to_string();
    let ts = now();
    sqlx::query(
        "INSERT INTO graph (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)"
    )
    .bind(&id).bind(&name).bind(&ts).bind(&ts)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(Graph { id, name, created_at: ts.clone(), updated_at: ts })
}

#[tauri::command]
pub async fn get_graphs(pool: State<'_, SqlitePool>) -> Result<Vec<Graph>, String> {
    sqlx::query_as::<_, Graph>(
        "SELECT id, name, created_at, updated_at FROM graph ORDER BY created_at ASC"
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_graph(pool: State<'_, SqlitePool>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM graph WHERE id = ?")
        .bind(&id).execute(pool.inner()).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn rename_graph(
    pool: State<'_, SqlitePool>,
    id: String,
    name: String,
) -> Result<(), String> {
    let ts = now();
    sqlx::query("UPDATE graph SET name = ?, updated_at = ? WHERE id = ?")
        .bind(&name).bind(&ts).bind(&id)
        .execute(pool.inner()).await.map_err(|e| e.to_string())?;
    Ok(())
}

// ── Task commands ─────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_tasks(
    pool: State<'_, SqlitePool>,
    graph_id: String,
) -> Result<Vec<Task>, String> {
    sqlx::query_as::<_, Task>(
        "SELECT id, graph_id, title, description, status, position, created_at, updated_at
         FROM task WHERE graph_id = ? ORDER BY position ASC"
    )
    .bind(&graph_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_task(
    pool: State<'_, SqlitePool>,
    graph_id: String,
    title: String,
) -> Result<Task, String> {
    let id = Uuid::new_v4().to_string();
    let ts = now();

    let max_pos: Option<f64> = sqlx::query_scalar(
        "SELECT MAX(position) FROM task WHERE graph_id = ?"
    )
    .bind(&graph_id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    let position = max_pos.unwrap_or(0.0) + 1000.0;

    sqlx::query(
        "INSERT INTO task (id, graph_id, title, description, status, position, created_at, updated_at)
         VALUES (?, ?, ?, '', 'todo', ?, ?, ?)"
    )
    .bind(&id).bind(&graph_id).bind(&title).bind(position).bind(&ts).bind(&ts)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(Task {
        id, graph_id, title,
        description: String::new(),
        status: "todo".to_string(),
        position,
        created_at: ts.clone(),
        updated_at: ts,
    })
}

#[tauri::command]
pub async fn update_task(
    pool: State<'_, SqlitePool>,
    task_id: String,
    title: Option<String>,
    description: Option<String>,
    status: Option<String>,
) -> Result<Task, String> {
    let ts = now();

    if let Some(ref t) = title {
        sqlx::query("UPDATE task SET title = ?, updated_at = ? WHERE id = ?")
            .bind(t).bind(&ts).bind(&task_id)
            .execute(pool.inner()).await.map_err(|e| e.to_string())?;
    }
    if let Some(ref d) = description {
        sqlx::query("UPDATE task SET description = ?, updated_at = ? WHERE id = ?")
            .bind(d).bind(&ts).bind(&task_id)
            .execute(pool.inner()).await.map_err(|e| e.to_string())?;
    }
    if let Some(ref s) = status {
        sqlx::query("UPDATE task SET status = ?, updated_at = ? WHERE id = ?")
            .bind(s).bind(&ts).bind(&task_id)
            .execute(pool.inner()).await.map_err(|e| e.to_string())?;
    }

    sqlx::query_as::<_, Task>(
        "SELECT id, graph_id, title, description, status, position, created_at, updated_at
         FROM task WHERE id = ?"
    )
    .bind(&task_id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_task(pool: State<'_, SqlitePool>, task_id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM task WHERE id = ?")
        .bind(&task_id).execute(pool.inner()).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn reorder_task(
    pool: State<'_, SqlitePool>,
    task_id: String,
    new_position: f64,
) -> Result<(), String> {
    let ts = now();
    sqlx::query("UPDATE task SET position = ?, updated_at = ? WHERE id = ?")
        .bind(new_position).bind(&ts).bind(&task_id)
        .execute(pool.inner()).await.map_err(|e| e.to_string())?;
    Ok(())
}

// ── Edge commands ─────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_edges(
    pool: State<'_, SqlitePool>,
    graph_id: String,
) -> Result<Vec<Edge>, String> {
    sqlx::query_as::<_, Edge>(
        "SELECT id, graph_id, source_id, target_id FROM edge WHERE graph_id = ?"
    )
    .bind(&graph_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_edge(
    pool: State<'_, SqlitePool>,
    graph_id: String,
    source_id: String,
    target_id: String,
) -> Result<Edge, String> {
    if source_id == target_id {
        return Err("Self-loop not allowed".to_string());
    }
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO edge (id, graph_id, source_id, target_id) VALUES (?, ?, ?, ?)"
    )
    .bind(&id).bind(&graph_id).bind(&source_id).bind(&target_id)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(Edge { id, graph_id, source_id, target_id })
}

#[tauri::command]
pub async fn remove_edge(pool: State<'_, SqlitePool>, edge_id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM edge WHERE id = ?")
        .bind(&edge_id).execute(pool.inner()).await.map_err(|e| e.to_string())?;
    Ok(())
}

// ── Resource commands ─────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_resources(
    pool: State<'_, SqlitePool>,
    task_id: String,
) -> Result<Vec<TaskResource>, String> {
    sqlx::query_as::<_, TaskResource>(
        "SELECT id, task_id, label, url, kind FROM task_resource WHERE task_id = ?"
    )
    .bind(&task_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_resource(
    pool: State<'_, SqlitePool>,
    task_id: String,
    label: String,
    url: String,
    kind: String,
) -> Result<TaskResource, String> {
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO task_resource (id, task_id, label, url, kind) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(&id).bind(&task_id).bind(&label).bind(&url).bind(&kind)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;

    Ok(TaskResource { id, task_id, label, url, kind })
}

#[tauri::command]
pub async fn remove_resource(pool: State<'_, SqlitePool>, resource_id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM task_resource WHERE id = ?")
        .bind(&resource_id).execute(pool.inner()).await.map_err(|e| e.to_string())?;
    Ok(())
}

// ── External URL opener ───────────────────────────────────────────────────────

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    // Basic safety: only allow http/https/file/mailto schemes
    let lower = url.to_ascii_lowercase();
    if !(lower.starts_with("http://")
        || lower.starts_with("https://")
        || lower.starts_with("file://")
        || lower.starts_with("mailto:"))
    {
        return Err(format!("Unsupported URL scheme: {}", url));
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}
