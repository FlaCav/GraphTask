import { Task, Edge, TaskStatus } from './types';

/**
 * Topological sort using Kahn's algorithm.
 * Tie-breaks among tasks with equal in-degree by `position` (ascending).
 * Returns sorted tasks. If the graph contains a cycle, throws an error.
 */
export function topologicalSort(tasks: Task[], edges: Edge[]): Task[] {
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();
  const taskMap = new Map<string, Task>();

  for (const t of tasks) {
    inDegree.set(t.id, 0);
    adjList.set(t.id, []);
    taskMap.set(t.id, t);
  }

  for (const e of edges) {
    adjList.get(e.sourceId)!.push(e.targetId);
    inDegree.set(e.targetId, (inDegree.get(e.targetId) ?? 0) + 1);
  }

  // Start queue: all tasks with in-degree 0, sorted by position
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
        const neighbor = taskMap.get(neighborId)!;
        // Insert maintaining position order
        const insertIdx = ready.findIndex(t => t.position > neighbor.position);
        if (insertIdx === -1) ready.push(neighbor);
        else ready.splice(insertIdx, 0, neighbor);
      }
    }
  }

  if (sorted.length !== tasks.length) {
    throw new Error('Cycle detected in task graph');
  }

  return sorted;
}

/**
 * Detect whether adding edge (sourceId → targetId) would create a cycle.
 * Returns true if a cycle would be created (i.e. the edge is INVALID).
 */
export function wouldCreateCycle(
  sourceId: string,
  targetId: string,
  edges: Edge[]
): boolean {
  if (sourceId === targetId) return true;

  // Build adjacency list from existing edges
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.sourceId)) adj.set(e.sourceId, []);
    adj.get(e.sourceId)!.push(e.targetId);
  }

  // BFS/DFS from targetId — if we can reach sourceId, adding the edge creates a cycle
  const visited = new Set<string>();
  const stack = [targetId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === sourceId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const next of adj.get(current) ?? []) {
      stack.push(next);
    }
  }

  return false;
}

/**
 * Compute effective status for a task.
 * A task is 'blocked' if any prerequisite is not 'done' and the task itself isn't 'done'.
 */
export function computeEffectiveStatus(
  task: Task,
  edges: Edge[],
  allTasks: Task[]
): TaskStatus {
  if (task.status === 'done') return 'done';

  const prereqEdges = edges.filter(e => e.targetId === task.id);
  if (prereqEdges.length === 0) return task.status;

  const taskMap = new Map(allTasks.map(t => [t.id, t]));
  const allPrereqsDone = prereqEdges.every(
    e => taskMap.get(e.sourceId)?.status === 'done'
  );

  return allPrereqsDone ? task.status : 'blocked';
}

/**
 * Compute effective statuses for all tasks in a graph.
 * Returns a map of taskId → effective TaskStatus.
 */
export function computeAllStatuses(
  tasks: Task[],
  edges: Edge[]
): Map<string, TaskStatus> {
  const result = new Map<string, TaskStatus>();
  for (const task of tasks) {
    result.set(task.id, computeEffectiveStatus(task, edges, tasks));
  }
  return result;
}

/**
 * Returns the set of task IDs that would cause a cycle if linked as
 * prerequisites OR dependents of the given task.
 * Used to grey out invalid selections in the task entry modal.
 */
export function getCyclicTaskIds(
  taskId: string,
  edges: Edge[],
  mode: 'prereq' | 'dependent'
): Set<string> {
  const invalid = new Set<string>();

  // Build full adjacency (both directions)
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.sourceId)) adj.set(e.sourceId, []);
    adj.get(e.sourceId)!.push(e.targetId);
  }

  // Collect all nodes reachable from a given start via DFS
  function reachable(start: string): Set<string> {
    const visited = new Set<string>();
    const stack = [start];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      for (const next of adj.get(cur) ?? []) stack.push(next);
    }
    return visited;
  }

  if (mode === 'prereq') {
    // Adding (candidateId → taskId). Would cycle if taskId can reach candidateId.
    const downstream = reachable(taskId);
    for (const id of downstream) {
      if (id !== taskId) invalid.add(id);
    }
  } else {
    // Adding (taskId → candidateId). Would cycle if candidateId can reach taskId.
    const upstream = new Set<string>();
    // Reverse BFS
    const radj = new Map<string, string[]>();
    for (const e of edges) {
      if (!radj.has(e.targetId)) radj.set(e.targetId, []);
      radj.get(e.targetId)!.push(e.sourceId);
    }
    const stack = [taskId];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (upstream.has(cur)) continue;
      upstream.add(cur);
      for (const next of radj.get(cur) ?? []) stack.push(next);
    }
    for (const id of upstream) {
      if (id !== taskId) invalid.add(id);
    }
  }

  return invalid;
}

/**
 * Reindex positions to even intervals (1000, 2000, 3000 …).
 * Call when fractional precision degrades after many reorders.
 */
export function reindexPositions(tasks: Task[]): Task[] {
  return tasks.map((t, i) => ({ ...t, position: (i + 1) * 1000 }));
}

/**
 * Compute midpoint position for drag-and-drop insertion between two tasks.
 */
export function midpointPosition(before: Task | null, after: Task | null): number {
  if (!before && !after) return 1000;
  if (!before) return after!.position - 500;
  if (!after) return before.position + 1000;
  return (before.position + after.position) / 2;
}
