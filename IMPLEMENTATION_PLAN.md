# GraphTask — Implementation Plan

## Overview

A desktop task-scheduling app where every todo list is a **directed acyclic graph (DAG)** displayed as a linear, topologically-sorted list. Users add tasks through a conversational prompt that guides them to declare dependencies, and can explore the graph through hover-arc visualizations and drill-down task cards.

---

## 1. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Desktop shell | **Tauri 2** | Tiny bundles, native Rust SQLite, secure IPC. Swap to Electron if native Node access is ever needed. |
| Frontend | **React 18 + TypeScript** | Component model fits the multi-view layout; strong ecosystem for state and animation. |
| Styling | **Tailwind CSS** | Already used across all prototypes; keeps the DESIGN.md tokens easy to port as a Tailwind theme. |
| State | **Zustand** | Lightweight, no boilerplate. Single store with slices for `graphs`, `tasks`, `edges`, and `ui`. |
| Database | **SQLite** via `tauri-plugin-sql` | Single local file. All queries go through Tauri commands (Rust side) exposed to the frontend over IPC. |
| Routing | **React Router v6** | Three routes: `/` (dashboard), `/graph/:id` (list page), task card is a panel overlay not a route. |
| Animation | **Framer Motion** | Spring-based transitions match the `cubic-bezier(0.34, 1.56, 0.64, 1)` easing in the design spec. |
| SVG arcs | **Manual SVG** in a React component | Lightweight; no charting library needed for simple quadratic-bezier arcs. |

---

## 2. Data Model

### 2.1 Schema (SQLite)

```sql
CREATE TABLE graph (
  id          TEXT PRIMARY KEY,  -- uuid
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE task (
  id          TEXT PRIMARY KEY,  -- uuid
  graph_id    TEXT NOT NULL REFERENCES graph(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'todo',  -- todo | in_progress | done | blocked
  position    REAL NOT NULL DEFAULT 0,       -- manual ordering (fractional indexing)
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE edge (
  id          TEXT PRIMARY KEY,
  graph_id    TEXT NOT NULL REFERENCES graph(id) ON DELETE CASCADE,
  source_id   TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,  -- prerequisite
  target_id   TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,  -- dependent
  UNIQUE(source_id, target_id)
);

-- Optional: rich content blocks, resource links, notes
CREATE TABLE task_resource (
  id        TEXT PRIMARY KEY,
  task_id   TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  label     TEXT NOT NULL,
  url       TEXT NOT NULL,
  kind      TEXT DEFAULT 'link'  -- link | note | file
);
```

### 2.2 DAG Invariants (enforced in application layer)

- **No self-loops**: `source_id ≠ target_id`.
- **No cycles**: Before inserting an edge `(A → B)`, run a DFS/BFS from `B` to verify `A` is unreachable.
- **Topological ordering**: The display order of the list is always a valid topological sort of the DAG. Recomputed on any edge change via Kahn's algorithm.

### 2.3 TypeScript Types

```ts
type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked';

interface Task {
  id: string;
  graphId: string;
  title: string;
  description: string;
  status: TaskStatus;
  position: number;    // manual ordering within topological constraints
  createdAt: string;
  updatedAt: string;
}

interface Edge {
  id: string;
  graphId: string;
  sourceId: string;  // prerequisite
  targetId: string;  // dependent (this task is blocked by source)
}

interface Graph {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## 3. Core Algorithm: Topological Sort + Position Ordering

The display order respects two constraints: **(1)** prerequisites always appear before their dependents (topological order), **(2)** among tasks with no ordering constraint, `position` determines order (user-controlled via drag).

```ts
function topologicalSort(tasks: Task[], edges: Edge[]): Task[] {
  // Kahn's algorithm with position-based tie-breaking
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();
  const taskMap = new Map<string, Task>();
  
  tasks.forEach(t => {
    inDegree.set(t.id, 0);
    adjList.set(t.id, []);
    taskMap.set(t.id, t);
  });
  
  edges.forEach(e => {
    adjList.get(e.sourceId)!.push(e.targetId);
    inDegree.set(e.targetId, (inDegree.get(e.targetId) ?? 0) + 1);
  });
  
  // Use a sorted queue: when multiple tasks have in-degree 0,
  // pick the one with the lowest position value first
  let ready = tasks
    .filter(t => (inDegree.get(t.id) ?? 0) === 0)
    .sort((a, b) => a.position - b.position);
  
  const sorted: Task[] = [];
  while (ready.length > 0) {
    const task = ready.shift()!;
    sorted.push(task);
    for (const neighborId of adjList.get(task.id) ?? []) {
      const newDeg = (inDegree.get(neighborId) ?? 1) - 1;
      inDegree.set(neighborId, newDeg);
      if (newDeg === 0) {
        // Insert into ready list maintaining position order
        const neighbor = taskMap.get(neighborId)!;
        const insertIdx = ready.findIndex(t => t.position > neighbor.position);
        if (insertIdx === -1) ready.push(neighbor);
        else ready.splice(insertIdx, 0, neighbor);
      }
    }
  }
  
  return sorted;
}
```

**New tasks** get `position = maxPositionInGraph + 1000` (appended to end). **Dragging** a task between two others sets its position to the midpoint of its neighbors' positions (fractional indexing). If precision degrades after many reorderings, a background re-index normalizes all positions to even intervals.

```ts
function computeBlockedStatus(task: Task, edges: Edge[], allTasks: Task[]): TaskStatus {
  // A task is "blocked" if any of its prerequisites are not "done"
  const prereqEdges = edges.filter(e => e.targetId === task.id);
  if (prereqEdges.length === 0) return task.status;
  
  const prereqTasks = prereqEdges.map(e => allTasks.find(t => t.id === e.sourceId)!);
  const allDone = prereqTasks.every(t => t.status === 'done');
  
  if (!allDone && task.status !== 'done') return 'blocked';
  return task.status;
}
```

---

## 4. Application Views & Components

### 4.1 View Map

```
/                          →  DashboardPage
/graph/:graphId            →  ListPage  (+ TaskCardPanel overlay + TaskEntryModal)
```

### 4.2 Component Tree

```
App
├── DashboardPage
│   ├── DashboardHeader          (greeting + "Create Graph" button)
│   ├── GraphCardGrid
│   │   └── GraphCard            (name, progress ring, task count)
│   └── EmptyState               (shown when no graphs exist)
│
├── ListPage
│   ├── ListHeader               ("Back to Dashboard" + graph title)
│   ├── TaskList
│   │   ├── ArcCanvas            (SVG overlay for dependency arcs)
│   │   └── TaskPill[]           (one per task, sorted topologically)
│   ├── AddTaskFAB               (floating "Add Task" button)
│   ├── TaskCardPanel            (right-side drawer, conditionally shown)
│   │   ├── TaskCardHeader       (title, close button)
│   │   ├── TaskDescription      (editable textarea)
│   │   ├── TaskResources        (link pills + add button)
│   │   ├── TaskNotes            (key constraint blocks)
│   │   ├── DependencySection    ("Blocked By" list)
│   │   ├── DependentSection     ("Blocks" list)
│   │   └── TaskCardFooter       ("Remove from graph")
│   └── TaskEntryModal           (conversational add-task flow)
│       ├── EntryChat            (assistant messages + suggestions)
│       └── EntryInput           (text input + send button)
```

---

## 5. Key Interactions — Detailed

### 5.1 Hover → Arc Visualization

**Trigger**: Mouse enters a `TaskPill`.

**Behavior**:
1. The hovered pill indents right (`translateX(8px)`), gets a subtle lift shadow.
2. An SVG `<path>` is drawn for each connected edge as a **left-side arc**:
   - **Prerequisites** (upstream): Periwinkle (`#9CAEF6`) arc from the prerequisite pill's left edge up/down to the hovered pill's left edge.
   - **Dependents** (downstream): Coral (`#F69C9C`) arc from the hovered pill's left edge down to the dependent pill's left edge.
3. Arcs are quadratic bezier curves anchored on the left margin. The control point extends further left for edges that span more rows (larger visual gap = wider arc).
4. Arcs animate in with a `stroke-dasharray` / `stroke-dashoffset` draw-on effect.
5. Connected pills get a subtle tinted border matching the arc color.

**Exit**: Mouse leaves the pill → arcs fade out (opacity transition 300ms), then removed from DOM.

**Arc geometry** (left-side arcs):

```ts
function computeArc(
  startY: number,    // center-Y of pill A
  endY: number,      // center-Y of pill B
  listLeftX: number  // left edge of the task list column
): string {
  const midY = (startY + endY) / 2;
  const distance = Math.abs(endY - startY);
  const curveDepth = Math.min(40 + distance * 0.15, 80); // how far left the arc bulges
  const cpX = listLeftX - curveDepth;
  
  return `M ${listLeftX} ${startY} Q ${cpX} ${midY} ${listLeftX} ${endY}`;
}
```

### 5.2 Click → Task Card Panel

**Trigger**: Click on a `TaskPill`.

**Behavior**:
1. The `TaskCardPanel` slides in from the right (480px wide, `translateX(100%) → 0`).
2. The main list area dims (backdrop with `bg-black/5 backdrop-blur-[2px]`).
3. The list is still visible and scrollable behind the dim layer, but pointer events are captured by the panel.
4. Inside the panel:
   - "Blocked By" section lists prerequisite tasks as tappable chips. Clicking one transitions the panel to show that task's card (quick fade/scale transition).
   - "Blocks" section lists dependent tasks the same way.
   - **Unlinking**: Each dependency chip shows a small `×` icon on hover (right edge of chip). Clicking `×` removes the edge only (not the task). A brief undo toast appears: "Unlinked '{taskName}' — Undo". The list re-sorts after unlinking.
   - Each section also has an `⊕` button to add a new dependency link (opens a small picker showing eligible tasks — those that wouldn't create a cycle).
   - "Remove from graph" in footer triggers deletion flow.
5. Close via the `×` button or clicking the dimmed backdrop.

### 5.3 Add Task — Conversational Entry Flow

**Trigger**: Click the floating "Add Task" button.

**Behavior** (multi-step modal):

```
┌─────────────────────────────────────────┐
│  Step 1: NAME                           │
│  "What's the task?"                     │
│  [___________________________] [→]      │
│                                         │
│  Step 2: PREREQUISITES                  │
│  "Does '{taskName}' depend on           │
│   anything already in the list?"        │
│  ┌─────────────┐ ┌──────────────┐       │
│  │ Task A (pill)│ │ Task B (pill)│ ...   │
│  └─────────────┘ └──────────────┘       │
│  [Skip — no prerequisites]              │
│                                         │
│  Step 3: DEPENDENTS                     │
│  "Does anything depend on               │
│   '{taskName}'?"                        │
│  ┌─────────────┐ ┌──────────────┐       │
│  │ Task C (pill)│ │ Task D (pill)│ ...   │
│  └─────────────┘ └──────────────┘       │
│  [Skip — nothing depends on this]       │
│                                         │
│  Step 4: CONFIRM                        │
│  "Adding '{taskName}'                   │
│   → blocked by: [A]                     │
│   → blocks: [C]"                        │
│  [Add to graph]                         │
└─────────────────────────────────────────┘
```

- Each step appears as a new "message" in the conversational UI, scrolling down.
- Existing tasks shown as selectable pill buttons (multi-select).
- If the list is empty (first task), steps 2–3 are skipped entirely — instant add.
- If user skips both dependency steps, the task is added immediately after step 1 (fast path for independent tasks).
- **Cycle detection**: When selecting prerequisites/dependents, any task whose selection would create a cycle is greyed out and unselectable.

### 5.4 Remove Task — Safe Deletion

**Trigger**: "Remove from graph" button in TaskCardPanel.

**Behavior**:
1. Show confirmation: "Remove '{taskName}'? Tasks that depended on this will be unblocked."
2. On confirm:
   - Delete all edges where this task is `source_id` or `target_id`.
   - Delete the task itself.
   - Recompute topological sort and blocked statuses for remaining tasks.
   - Close the panel, animate the pill out of the list.
3. **No re-linking**: Removing a task simply removes its edges. If `A → B → C` and you remove `B`, `A` and `C` become independent (not auto-linked). This is the safest default — auto-relinking could create unintended dependencies.

### 5.5 Status Cycling

Clicking the status icon on a `TaskPill` cycles through statuses:
- `todo` → `in_progress` → `done` → `todo`
- Exception: `blocked` status is computed, not manually set. If all prereqs are done, the task automatically becomes its underlying status.
- When a task is marked `done`, all downstream tasks that were `blocked` are re-evaluated.

---

## 6. State Management (Zustand)

```ts
interface AppState {
  // Data
  graphs: Graph[];
  tasks: Task[];           // all tasks across all graphs
  edges: Edge[];           // all edges across all graphs
  resources: TaskResource[];

  // UI state
  activeGraphId: string | null;
  hoveredTaskId: string | null;
  selectedTaskId: string | null;   // opens TaskCardPanel
  isEntryModalOpen: boolean;
  entryStep: 'name' | 'prereqs' | 'dependents' | 'confirm';

  // Derived (computed via selectors)
  // sortedTasks(graphId) → Task[]  (topologically sorted)
  // taskEdges(taskId) → { prereqs: Edge[], dependents: Edge[] }
  // graphProgress(graphId) → { done: number, total: number }

  // Actions
  createGraph(name: string): void;
  deleteGraph(id: string): void;
  addTask(graphId: string, title: string, prereqIds: string[], dependentIds: string[]): void;
  removeTask(taskId: string): void;
  updateTask(taskId: string, updates: Partial<Task>): void;
  addEdge(sourceId: string, targetId: string): void;
  removeEdge(edgeId: string): void;
  cycleTaskStatus(taskId: string): void;
}
```

---

## 7. Backend Layer (Tauri Commands)

All data mutations go through Tauri's Rust command system for safe SQLite access:

```rust
#[tauri::command]
fn create_graph(name: String) -> Result<Graph, String>;

#[tauri::command]
fn get_graphs() -> Result<Vec<Graph>, String>;

#[tauri::command]
fn get_tasks(graph_id: String) -> Result<Vec<Task>, String>;

#[tauri::command]
fn get_edges(graph_id: String) -> Result<Vec<Edge>, String>;

#[tauri::command]
fn add_task(graph_id: String, title: String) -> Result<Task, String>;

#[tauri::command]
fn add_edge(graph_id: String, source_id: String, target_id: String) -> Result<Edge, String>;

#[tauri::command]
fn remove_task(task_id: String) -> Result<(), String>;

#[tauri::command]
fn update_task(task_id: String, title: Option<String>, description: Option<String>, status: Option<String>) -> Result<Task, String>;

#[tauri::command]
fn reorder_task(task_id: String, new_position: f64) -> Result<(), String>;

#[tauri::command]
fn remove_edge(edge_id: String) -> Result<(), String>;
```

The frontend Zustand store calls these commands via `@tauri-apps/api/core` and syncs local state on success.

---

## 8. File / Folder Structure

```
graphtask/
├── src-tauri/                    # Tauri / Rust backend
│   ├── src/
│   │   ├── main.rs               # Tauri entry, register commands
│   │   ├── commands.rs            # All #[tauri::command] handlers
│   │   ├── db.rs                  # SQLite setup, migrations
│   │   └── models.rs              # Rust structs for Graph, Task, Edge
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── src/                          # React frontend
│   ├── main.tsx                  # Entry point
│   ├── App.tsx                   # Router setup
│   │
│   ├── stores/
│   │   └── useAppStore.ts        # Zustand store (all slices)
│   │
│   ├── lib/
│   │   ├── dag.ts                # topologicalSort, detectCycle, computeBlocked
│   │   ├── arc.ts                # SVG arc path generation
│   │   └── ids.ts                # UUID generation
│   │
│   ├── pages/
│   │   ├── DashboardPage.tsx
│   │   └── ListPage.tsx
│   │
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── GraphCard.tsx
│   │   │   ├── GraphCardGrid.tsx
│   │   │   └── EmptyState.tsx
│   │   │
│   │   ├── list/
│   │   │   ├── TaskPill.tsx
│   │   │   ├── TaskList.tsx
│   │   │   ├── ArcCanvas.tsx       # SVG overlay
│   │   │   └── AddTaskFAB.tsx
│   │   │
│   │   ├── card/
│   │   │   ├── TaskCardPanel.tsx
│   │   │   ├── DependencyChip.tsx
│   │   │   ├── TaskResources.tsx
│   │   │   └── TaskNotes.tsx
│   │   │
│   │   └── entry/
│   │       ├── TaskEntryModal.tsx
│   │       ├── EntryStepName.tsx
│   │       ├── EntryStepPrereqs.tsx
│   │       ├── EntryStepDependents.tsx
│   │       └── EntryStepConfirm.tsx
│   │
│   ├── hooks/
│   │   ├── useSortedTasks.ts     # Memoized topological sort
│   │   ├── useTaskEdges.ts       # Get prereqs + dependents for a task
│   │   └── useArcPositions.ts    # Compute arc SVG paths from DOM positions
│   │
│   └── styles/
│       └── tailwind.config.ts    # Full design token config from DESIGN.md
│
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 9. Implementation Phases

### Phase 1 — Foundation (Days 1–3)
- [ ] Scaffold Tauri + React + Vite + Tailwind project
- [ ] Port DESIGN.md tokens into `tailwind.config.ts` (colors, fonts, radii, shadows)
- [ ] Set up SQLite database with migrations (`graph`, `task`, `edge` tables)
- [ ] Implement Tauri commands for all CRUD operations
- [ ] Build Zustand store with Tauri IPC integration
- [ ] Implement `dag.ts` — topological sort, cycle detection, blocked-status computation
- [ ] Write unit tests for DAG logic (sort correctness, cycle rejection)

### Phase 2 — Dashboard (Days 4–5)
- [ ] `DashboardPage` with header ("Good morning." + "Create Graph" button)
- [ ] `GraphCard` component with SVG progress ring
- [ ] `GraphCardGrid` with responsive layout (1/2/3 columns)
- [ ] `EmptyState` display
- [ ] Create-graph modal (simple name input)
- [ ] Navigation: click card → `/graph/:id`

### Phase 3 — List Page Core (Days 6–9)
- [ ] `ListPage` layout with back nav + graph title
- [ ] `TaskPill` component (icon, title, status pill)
- [ ] `TaskList` rendering tasks in topological order respecting `position` tie-breaks
- [ ] Status cycling on icon click (todo → in_progress → done, with blocked auto-compute)
- [ ] Hover interaction: pill indent + shadow
- [ ] `ArcCanvas` — SVG overlay positioned absolutely over the list
- [ ] Arc drawing on hover: left-side quadratic bezier curves
- [ ] Arc colors: periwinkle for prereqs, coral for dependents
- [ ] Arc entrance/exit animations (stroke-dasharray draw-on, opacity fade)
- [ ] Connected-pill border highlighting during hover
- [ ] Drag-and-drop reordering: drag a pill to a new position. On drop, validate against DAG constraints — if the position is above a prereq or below a dependent, show an error toast and snap back. Uses fractional indexing on `position`.

### Phase 4 — Task Card Panel (Days 10–12)
- [ ] `TaskCardPanel` slide-in drawer (480px, right side)
- [ ] Backdrop dim + blur on the list behind it
- [ ] Editable title (contentEditable or controlled input)
- [ ] Description textarea
- [ ] Resources section (link pills + add button)
- [ ] Notes/constraint blocks
- [ ] "Blocked By" section with `DependencyChip` components
- [ ] "Blocks" section with `DependencyChip` components
- [ ] **Edge unlinking**: `×` on hover on each dependency chip → removes the edge (not the task), brief undo toast
- [ ] **Edge adding**: `⊕` button in each section → picker showing eligible tasks (cycle-safe only)
- [ ] Click a dependency chip → transition panel to that task's card
- [ ] "Remove from graph" with confirmation dialog
- [ ] Close panel on `×` or backdrop click

### Phase 5 — Conversational Task Entry (Days 13–16)
- [ ] `TaskEntryModal` with backdrop dim + center popup
- [ ] Step 1: task name input with send button
- [ ] Step 2: "Does this depend on anything?" — render existing tasks as selectable pills, multi-select, skip option
- [ ] Step 3: "Does anything depend on this?" — same pattern, with cycle-unsafe tasks greyed out
- [ ] Step 4: confirmation summary + "Add to graph" button
- [ ] Fast path: if list empty or user skips both steps → immediate add
- [ ] Conversational scroll — each step appends as a chat message
- [ ] On confirm: insert task + edges, recompute sort, close modal, animate new pill into list

### Phase 6 — Polish & Edge Cases (Days 17–20)
- [ ] Framer Motion page transitions (dashboard ↔ list page)
- [ ] Pill reorder animation when topological sort changes
- [ ] Keyboard navigation (Escape closes panels/modals, Enter confirms)
- [ ] Deletion edge case: confirmation messaging about orphaned relationships
- [ ] Graph deletion from dashboard (with confirmation)
- [ ] Graph rename (inline edit on list page header)
- [ ] Window resizing — responsive arc recalculation
- [ ] Empty list state on the list page
- [ ] Error handling / toast notifications for failed operations

### Phase 7 — Stretch Goals
- [ ] Drag forbidden-zone indicators: grey out invalid drop positions during drag (above prereqs, below dependents)
- [ ] Full undo/redo stack for task + edge mutations
- [ ] Dark mode (DESIGN.md already has `background-dark: #11211e`)
- [ ] Export graph as JSON / image
- [ ] Task due dates + calendar integration
- [ ] Search / filter within a graph
- [ ] Multiple dependency visualization modes (arcs vs. straight lines toggle)
- [ ] Graph descriptions, deadlines, or color labels (extend metadata later)

---

## 10. Key Design Decisions & Rationale

**Why left-side arcs instead of center bezier curves?**
The prototype in `list-page-code.html` draws center-to-center curves that cross over the task pills. The `listpagewitharcsscreen.png` screenshot shows the intended design: arcs on the left margin. This is cleaner because arcs never occlude task text, the visual language clearly separates "structure" (left) from "content" (center), and it scales better when many tasks are connected.

**Why conversational entry instead of a form?**
Traditional task tools dump all fields on you at once. The conversational prompt mirrors how people actually think: "What do I need to do?" → "What does this depend on?" → "What does this unlock?" This guided flow reduces cognitive load and makes dependency-linking feel natural rather than administrative.

**Why no auto-relinking on delete?**
If `A → B → C` and you delete `B`, automatically creating `A → C` could introduce unwanted dependencies. The user declared `A → B` and `B → C` as separate relationships — the transitive link may not be intended. Safer to unlink and let the user reconnect if needed.

**Why Kahn's algorithm over DFS-based topo sort?**
Kahn's naturally detects cycles (if the sorted output is shorter than the input, a cycle exists). It also gives a stable, deterministic ordering which is important for consistent UI — you don't want the list shuffling unnecessarily on every re-render.

---

## 11. Resolved Questions

1. ~~**Multi-select dependencies**: Multi-select confirmed for steps 2–3.~~ ✅
2. ~~**Task editing**: Dependency editing happens in the card panel. Each chip has an `×` to unlink, and each section has `⊕` to add new links.~~ ✅
3. ~~**Ordering ties**: New tasks append to end. Users can drag-reorder within topological constraints.~~ ✅
4. ~~**Graph-level metadata**: Graphs have a name (prompted on creation). More metadata deferred to stretch goals.~~ ✅
5. ~~**Drag feedback**: On invalid drop (above a prereq or below a dependent), show an error message and snap the pill back to its original position. Forbidden-zone visual indicators (greying out invalid drop targets during drag) deferred to stretch goals.~~ ✅
6. ~~**Undo for unlinking**: Brief toast with "Undo" button is sufficient. Full undo/redo stack deferred to stretch goals.~~ ✅
