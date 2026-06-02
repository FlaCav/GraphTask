import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { Graph, Task, Edge, TaskResource, TaskStatus } from '../lib/types';
import { topologicalSort, computeAllStatuses, wouldCreateCycle } from '../lib/dag';

// ── Raw shapes returned by Tauri (snake_case) ─────────────────────────────────

interface RawGraph {
  id: string; name: string;
  created_at: string; updated_at: string;
}
interface RawTask {
  id: string; graph_id: string; title: string; description: string;
  status: string; position: number; created_at: string; updated_at: string;
}
interface RawEdge {
  id: string; graph_id: string; source_id: string; target_id: string;
}
function mapGraph(r: RawGraph): Graph {
  return { id: r.id, name: r.name, createdAt: r.created_at, updatedAt: r.updated_at };
}
function mapTask(r: RawTask): Task {
  return {
    id: r.id, graphId: r.graph_id, title: r.title, description: r.description,
    status: r.status as TaskStatus, position: r.position,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
function mapEdge(r: RawEdge): Edge {
  return { id: r.id, graphId: r.graph_id, sourceId: r.source_id, targetId: r.target_id };
}
// Note: TaskResource mapping is done inline at fetch sites (kept for future use).

// ── Store interface ───────────────────────────────────────────────────────────

interface AppState {
  // Data
  graphs: Graph[];
  tasks: Task[];
  edges: Edge[];
  resources: TaskResource[];

  // UI state
  activeGraphId: string | null;
  hoveredTaskId: string | null;
  selectedTaskId: string | null;
  isEntryModalOpen: boolean;
  entryStep: 'name' | 'prereqs' | 'dependents' | 'confirm';

  // Derived selectors
  sortedTasks: (graphId: string) => Task[];
  taskEdges: (taskId: string) => { prereqs: Edge[]; dependents: Edge[] };
  graphProgress: (graphId: string) => { done: number; total: number };
  effectiveStatus: (taskId: string) => TaskStatus;

  // Bootstrap
  loadGraphs: () => Promise<void>;
  loadGraph: (graphId: string) => Promise<void>;

  // Graph actions
  createGraph: (name: string) => Promise<Graph>;
  deleteGraph: (id: string) => Promise<void>;
  renameGraph: (id: string, name: string) => Promise<void>;

  // Task actions
  addTask: (graphId: string, title: string, prereqIds: string[], dependentIds: string[]) => Promise<Task>;
  removeTask: (taskId: string) => Promise<void>;
  updateTask: (taskId: string, updates: { title?: string; description?: string; status?: string }) => Promise<void>;
  cycleTaskStatus: (taskId: string) => Promise<void>;
  reorderTask: (taskId: string, newPosition: number) => Promise<void>;

  // Edge actions
  addEdge: (graphId: string, sourceId: string, targetId: string) => Promise<Edge | null>;
  removeEdge: (edgeId: string) => Promise<void>;

  // UI actions
  setActiveGraph: (id: string | null) => void;
  setHoveredTask: (id: string | null) => void;
  setSelectedTask: (id: string | null) => void;
  openEntryModal: () => void;
  closeEntryModal: () => void;
  setEntryStep: (step: AppState['entryStep']) => void;
}

// ── Store implementation ──────────────────────────────────────────────────────

export const useAppStore = create<AppState>((set, get) => ({
  graphs: [],
  tasks: [],
  edges: [],
  resources: [],

  activeGraphId: null,
  hoveredTaskId: null,
  selectedTaskId: null,
  isEntryModalOpen: false,
  entryStep: 'name',

  // ── Derived selectors ──────────────────────────────────────────────────────

  sortedTasks: (graphId) => {
    const { tasks, edges } = get();
    const graphTasks = tasks.filter(t => t.graphId === graphId);
    const graphEdges = edges.filter(e => e.graphId === graphId);
    try {
      return topologicalSort(graphTasks, graphEdges);
    } catch {
      return graphTasks.sort((a, b) => a.position - b.position);
    }
  },

  taskEdges: (taskId) => {
    const { edges } = get();
    return {
      prereqs: edges.filter(e => e.targetId === taskId),
      dependents: edges.filter(e => e.sourceId === taskId),
    };
  },

  graphProgress: (graphId) => {
    const { tasks, edges } = get();
    const graphTasks = tasks.filter(t => t.graphId === graphId);
    const graphEdges = edges.filter(e => e.graphId === graphId);
    const statuses = computeAllStatuses(graphTasks, graphEdges);
    const done = [...statuses.values()].filter(s => s === 'done').length;
    return { done, total: graphTasks.length };
  },

  effectiveStatus: (taskId) => {
    const { tasks, edges } = get();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return 'todo';
    const graphTasks = tasks.filter(t => t.graphId === task.graphId);
    const graphEdges = edges.filter(e => e.graphId === task.graphId);
    const statuses = computeAllStatuses(graphTasks, graphEdges);
    return statuses.get(taskId) ?? task.status;
  },

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  loadGraphs: async () => {
    const raw = await invoke<RawGraph[]>('get_graphs');
    set({ graphs: raw.map(mapGraph) });
  },

  loadGraph: async (graphId) => {
    const [rawTasks, rawEdges] = await Promise.all([
      invoke<RawTask[]>('get_tasks', { graphId }),
      invoke<RawEdge[]>('get_edges', { graphId }),
    ]);
    const newTasks = rawTasks.map(mapTask);
    const newEdges = rawEdges.map(mapEdge);
    set(state => ({
      tasks: [
        ...state.tasks.filter(t => t.graphId !== graphId),
        ...newTasks,
      ],
      edges: [
        ...state.edges.filter(e => e.graphId !== graphId),
        ...newEdges,
      ],
    }));
  },

  // ── Graph actions ──────────────────────────────────────────────────────────

  createGraph: async (name) => {
    const raw = await invoke<RawGraph>('create_graph', { name });
    const graph = mapGraph(raw);
    set(state => ({ graphs: [...state.graphs, graph] }));
    return graph;
  },

  deleteGraph: async (id) => {
    await invoke('delete_graph', { id });
    set(state => ({
      graphs: state.graphs.filter(g => g.id !== id),
      tasks: state.tasks.filter(t => t.graphId !== id),
      edges: state.edges.filter(e => e.graphId !== id),
    }));
  },

  renameGraph: async (id, name) => {
    await invoke('rename_graph', { id, name });
    set(state => ({
      graphs: state.graphs.map(g => g.id === id ? { ...g, name } : g),
    }));
  },

  // ── Task actions ───────────────────────────────────────────────────────────

  addTask: async (graphId, title, prereqIds, dependentIds) => {
    const raw = await invoke<RawTask>('add_task', { graphId, title });
    const task = mapTask(raw);
    set(state => ({ tasks: [...state.tasks, task] }));

    // Add prerequisite edges (prereq → new task)
    for (const sourceId of prereqIds) {
      await get().addEdge(graphId, sourceId, task.id);
    }
    // Add dependent edges (new task → dependent)
    for (const targetId of dependentIds) {
      await get().addEdge(graphId, task.id, targetId);
    }

    return task;
  },

  removeTask: async (taskId) => {
    await invoke('remove_task', { taskId });
    set(state => ({
      tasks: state.tasks.filter(t => t.id !== taskId),
      edges: state.edges.filter(e => e.sourceId !== taskId && e.targetId !== taskId),
    }));
  },

  updateTask: async (taskId, updates) => {
    const raw = await invoke<RawTask>('update_task', {
      taskId,
      title: updates.title ?? null,
      description: updates.description ?? null,
      status: updates.status ?? null,
    });
    const updated = mapTask(raw);
    set(state => ({
      tasks: state.tasks.map(t => t.id === taskId ? updated : t),
    }));
  },

  cycleTaskStatus: async (taskId) => {
    const task = get().tasks.find(t => t.id === taskId);
    if (!task) return;

    // blocked is computed — cycle underlying status
    const current = task.status === 'blocked' ? 'todo' : task.status;
    const next: Record<string, TaskStatus> = {
      todo: 'in_progress',
      in_progress: 'done',
      done: 'todo',
    };
    const newStatus = next[current] ?? 'todo';
    await get().updateTask(taskId, { status: newStatus });
  },

  reorderTask: async (taskId, newPosition) => {
    await invoke('reorder_task', { taskId, newPosition });
    set(state => ({
      tasks: state.tasks.map(t => t.id === taskId ? { ...t, position: newPosition } : t),
    }));
  },

  // ── Edge actions ───────────────────────────────────────────────────────────

  addEdge: async (graphId, sourceId, targetId) => {
    const { edges } = get();
    if (wouldCreateCycle(sourceId, targetId, edges)) {
      console.warn('Edge rejected: would create cycle');
      return null;
    }
    const raw = await invoke<RawEdge>('add_edge', { graphId, sourceId, targetId });
    const edge = mapEdge(raw);
    set(state => ({ edges: [...state.edges, edge] }));
    return edge;
  },

  removeEdge: async (edgeId) => {
    await invoke('remove_edge', { edgeId });
    set(state => ({ edges: state.edges.filter(e => e.id !== edgeId) }));
  },

  // ── UI actions ─────────────────────────────────────────────────────────────

  setActiveGraph: (id) => set({ activeGraphId: id }),
  setHoveredTask: (id) => set({ hoveredTaskId: id }),
  setSelectedTask: (id) => set({ selectedTaskId: id }),
  openEntryModal: () => set({ isEntryModalOpen: true, entryStep: 'name' }),
  closeEntryModal: () => set({ isEntryModalOpen: false, entryStep: 'name' }),
  setEntryStep: (step) => set({ entryStep: step }),
}));
