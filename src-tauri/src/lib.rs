mod commands;
mod db;
mod models;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .setup(|app| {
            let pool = tauri::async_runtime::block_on(db::init_db(app))
                .expect("Failed to initialize database");
            app.manage(pool);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::create_graph,
            commands::get_graphs,
            commands::delete_graph,
            commands::rename_graph,
            commands::get_tasks,
            commands::add_task,
            commands::update_task,
            commands::remove_task,
            commands::reorder_task,
            commands::get_edges,
            commands::add_edge,
            commands::remove_edge,
            commands::get_resources,
            commands::add_resource,
            commands::remove_resource,
            commands::open_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
