use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Graph {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Task {
    pub id: String,
    pub graph_id: String,
    pub title: String,
    pub description: String,
    pub status: String,
    pub position: f64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct Edge {
    pub id: String,
    pub graph_id: String,
    pub source_id: String,
    pub target_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct TaskResource {
    pub id: String,
    pub task_id: String,
    pub label: String,
    pub url: String,
    pub kind: String,
}
