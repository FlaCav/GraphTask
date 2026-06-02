# 🕸️ GraphTask

> A desktop task-scheduling app where every todo list is a **directed acyclic graph (DAG)** displayed as a linear, topologically-sorted list.

Instead of a flat checklist, GraphTask understands which tasks **block** which. The list auto-orders itself so you always know what to work on next. Built with Tauri 2, React, and SQLite — runs natively on Windows, macOS, and Linux.

---

## ✨ What it does

- 📋 **Graphs of tasks** — Each project is its own graph. Dashboard shows all graphs with progress rings.
- 🔗 **Dependencies** — Mark any task as **blocked by** or **blocks** any other. Cycles are prevented automatically.
- 📐 **Topological order** — The list re-orders itself so prerequisites come before dependents. No mental gymnastics.
- 🚦 **Auto-blocked status** — A task is `Blocked` as long as any prerequisite is incomplete. Status flips to `To Do` the moment the last blocker is `Done`.
- 🎨 **Visual arc lines** — Hover any task; soft curves appear on the left showing what it depends on (blue) and what depends on it (coral).
- 🖱️ **Drag to reorder** — Reorder tasks freely, but the DAG enforces dependency rules (you can't move a task above its own prerequisite).
- 🔖 **Resources** — Attach URLs, notes, or files to any task. One click opens them in your browser.
- ✏️ **Inline rename** — Click any graph or task title to edit it in place.
- 💾 **Local-first** — All data lives in a single SQLite file on your machine. No accounts, no cloud, no telemetry.

---

## 🧭 How to use it

### 1. Create a graph

Click the big **+** card on the dashboard and give your project a name. ("Today ToDo", "Launch Plan", "Move apartments"...)

### 2. Add tasks

Inside a graph, hit **Add Task** at the bottom. A conversational modal walks you through:

1. **What's the task?** — Type a title.
2. **Does it depend on anything?** — Tap any existing tasks that must be done first. Skip if none.
3. **Does anything depend on it?** — Tap any existing tasks that should wait for this one. Skip if none.
4. **Confirm** — Review and add to the graph.

### 3. Work the list

- 🔘 Click the **status circle** on a pill to cycle: `To Do → In Progress → Done`.
- 🚫 `Blocked` is computed — you can't set it manually. Finish the blocker, and the task unblocks itself.
- 🖼️ **Hover a pill** to see its connections drawn as arcs on the left side.
- ↕️ **Drag pills** up or down to reorder within the DAG's allowed range.

### 4. Open a task card

Click any task pill to slide out a side panel. From there:

- 📝 Edit the **description** (long-form context, acceptance criteria, links).
- 🔗 Add **prerequisites** or **dependents** with the **+** buttons next to "Blocked By" / "Blocks". Cycles are blocked automatically.
- 🌐 Add **resources** (URLs, notes). Click a resource pill to open it; hover for **copy** and **remove** buttons.
- 🗑️ **Remove from graph** at the bottom right.

### 5. Keyboard shortcuts

- `Esc` — Close the task card panel, the entry modal, or cancel an inline rename.
- `Enter` — Confirm an inline edit.

---

## 🚀 Run it locally

### Prerequisites

Install once per machine:

| Tool | Why | Install |
|---|---|---|
| 🦀 **Rust** (latest stable) | Tauri backend | https://rustup.rs |
| 🟢 **Node.js** (LTS) | Frontend tooling | https://nodejs.org or `brew install node` |
| 🛠️ **Tauri CLI** | Build orchestrator | `cargo install tauri-cli --version "^2.0" --locked` |
| 🪟 **MSVC Build Tools** (Windows only) | Linker for Rust | https://visualstudio.microsoft.com/visual-cpp-build-tools/ |
| 🍎 **Xcode Command Line Tools** (macOS only) | Linker + WebKit | `xcode-select --install` |
| 🐧 **WebKit2GTK + build-essential** (Linux only) | WebView + linker | `sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libayatana-appindicator3-dev librsvg2-dev` |

### Clone and run

```bash
git clone https://github.com/FlaCav/graphtask.git
cd graphtask
npm install
cargo tauri dev
```

First launch compiles Rust (~5–10 min). Subsequent launches are fast (~5 s).

### Run the tests

```bash
npm test           # one-shot Vitest run (28 DAG unit tests)
npm run test:watch # watch mode
```

### Build a production installer

```bash
cargo tauri build
```

Native installer ends up in `src-tauri/target/release/bundle/`:

- 🪟 **Windows**: `.msi` and `.exe`
- 🍎 **macOS**: `.app` and `.dmg`
- 🐧 **Linux**: `.deb`, `.rpm`, `.AppImage`

Each installer can only be built on its own OS.

---

## 💾 Where your data lives

Single SQLite file. Portable across operating systems — copy it to migrate machines.

| OS | Path |
|---|---|
| 🪟 Windows | `%APPDATA%\com.tauri.dev\graphtask.db` |
| 🍎 macOS | `~/Library/Application Support/com.tauri.dev/graphtask.db` |
| 🐧 Linux | `~/.local/share/com.tauri.dev/graphtask.db` |

Open it with [DB Browser for SQLite](https://sqlitebrowser.org), the `sqlite3` CLI, or any VS Code SQLite extension.

**Reset everything**: quit the app, delete the `.db` file, relaunch. Empty schema is recreated.

---

## 🧱 Tech stack

- **Backend**: Rust + Tauri 2 + sqlx (SQLite) + tokio
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS v4 + Framer Motion + Zustand + React Router
- **DAG core**: Kahn's algorithm (topological sort with position tie-break), DFS-based cycle detection
- **Tests**: Vitest

---

## 📂 Project layout

```
graphtask/
├── src/                  # React frontend
│   ├── components/       # UI (dashboard, list, card, entry modal)
│   ├── pages/            # DashboardPage, ListPage
│   ├── stores/           # Zustand store (Tauri IPC bridge)
│   ├── hooks/            # useSortedTasks, useTaskEdges
│   └── lib/              # dag.ts (algorithms), arc.ts (SVG paths), types.ts
├── src-tauri/            # Rust backend
│   ├── src/
│   │   ├── commands.rs   # IPC handlers (CRUD + open_url)
│   │   ├── db.rs         # SQLite pool + migrations
│   │   └── models.rs     # Serde structs
│   └── tauri.conf.json   # App identifier, window, bundle config
└── design/               # Mockups + design tokens
```
