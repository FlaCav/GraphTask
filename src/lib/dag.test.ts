import { describe, it, expect } from 'vitest';
import {
  topologicalSort,
  wouldCreateCycle,
  computeEffectiveStatus,
  computeAllStatuses,
  getCyclicTaskIds,
  midpointPosition,
  reindexPositions,
} from './dag';
import { Task, Edge } from './types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function task(id: string, position = 0, status: Task['status'] = 'todo'): Task {
  return {
    id, graphId: 'g1', title: id, description: '', status, position,
    createdAt: '', updatedAt: '',
  };
}

function edge(sourceId: string, targetId: string): Edge {
  return { id: `${sourceId}->${targetId}`, graphId: 'g1', sourceId, targetId };
}

// ── topologicalSort ───────────────────────────────────────────────────────────

describe('topologicalSort', () => {
  it('returns single task unchanged', () => {
    const tasks = [task('A')];
    expect(topologicalSort(tasks, [])).toEqual(tasks);
  });

  it('prerequisite comes before dependent', () => {
    const tasks = [task('A', 1000), task('B', 2000)];
    const edges = [edge('A', 'B')]; // A is prereq of B
    const sorted = topologicalSort(tasks, edges);
    expect(sorted.map(t => t.id)).toEqual(['A', 'B']);
  });

  it('prerequisite comes before dependent regardless of position order', () => {
    // B has lower position but depends on A
    const tasks = [task('A', 2000), task('B', 1000)];
    const edges = [edge('A', 'B')];
    const sorted = topologicalSort(tasks, edges);
    expect(sorted.map(t => t.id)).toEqual(['A', 'B']);
  });

  it('tie-breaks by position when no ordering constraint', () => {
    const tasks = [task('C', 3000), task('A', 1000), task('B', 2000)];
    const sorted = topologicalSort(tasks, []);
    expect(sorted.map(t => t.id)).toEqual(['A', 'B', 'C']);
  });

  it('handles diamond dependency: A→B, A→C, B→D, C→D', () => {
    const tasks = [task('A', 1000), task('B', 2000), task('C', 3000), task('D', 4000)];
    const edges = [edge('A', 'B'), edge('A', 'C'), edge('B', 'D'), edge('C', 'D')];
    const sorted = topologicalSort(tasks, edges);
    const ids = sorted.map(t => t.id);
    // A must be first, D must be last
    expect(ids[0]).toBe('A');
    expect(ids[3]).toBe('D');
    // B and C are in middle in position order
    expect(ids.slice(1, 3).sort()).toEqual(['B', 'C']);
  });

  it('throws on cycle', () => {
    const tasks = [task('A'), task('B'), task('C')];
    const edges = [edge('A', 'B'), edge('B', 'C'), edge('C', 'A')];
    expect(() => topologicalSort(tasks, edges)).toThrow('Cycle detected');
  });

  it('handles empty input', () => {
    expect(topologicalSort([], [])).toEqual([]);
  });

  it('handles multiple independent chains', () => {
    // Chain 1: X→Y, Chain 2: A→B, positions interleaved
    const tasks = [task('A', 100), task('X', 200), task('B', 300), task('Y', 400)];
    const edges = [edge('A', 'B'), edge('X', 'Y')];
    const sorted = topologicalSort(tasks, edges);
    const ids = sorted.map(t => t.id);
    // A before B, X before Y
    expect(ids.indexOf('A')).toBeLessThan(ids.indexOf('B'));
    expect(ids.indexOf('X')).toBeLessThan(ids.indexOf('Y'));
  });
});

// ── wouldCreateCycle ──────────────────────────────────────────────────────────

describe('wouldCreateCycle', () => {
  it('self-loop always cycles', () => {
    expect(wouldCreateCycle('A', 'A', [])).toBe(true);
  });

  it('no cycle on empty graph', () => {
    expect(wouldCreateCycle('A', 'B', [])).toBe(false);
  });

  it('detects direct cycle A→B + B→A', () => {
    const edges = [edge('A', 'B')];
    expect(wouldCreateCycle('B', 'A', edges)).toBe(true);
  });

  it('detects transitive cycle A→B→C + C→A', () => {
    const edges = [edge('A', 'B'), edge('B', 'C')];
    expect(wouldCreateCycle('C', 'A', edges)).toBe(true);
  });

  it('allows valid edge in existing graph', () => {
    const edges = [edge('A', 'B'), edge('B', 'C')];
    expect(wouldCreateCycle('A', 'C', edges)).toBe(false);
  });
});

// ── computeEffectiveStatus ────────────────────────────────────────────────────

describe('computeEffectiveStatus', () => {
  it('task with no prereqs returns own status', () => {
    const t = task('A', 0, 'todo');
    expect(computeEffectiveStatus(t, [], [t])).toBe('todo');
  });

  it('done task stays done regardless of prereqs', () => {
    const prereq = task('A', 0, 'todo');
    const t = task('B', 1000, 'done');
    const edges = [edge('A', 'B')];
    expect(computeEffectiveStatus(t, edges, [prereq, t])).toBe('done');
  });

  it('task with incomplete prereq becomes blocked', () => {
    const prereq = task('A', 0, 'todo');
    const t = task('B', 1000, 'todo');
    const edges = [edge('A', 'B')];
    expect(computeEffectiveStatus(t, edges, [prereq, t])).toBe('blocked');
  });

  it('task with all prereqs done returns own status', () => {
    const prereq = task('A', 0, 'done');
    const t = task('B', 1000, 'in_progress');
    const edges = [edge('A', 'B')];
    expect(computeEffectiveStatus(t, edges, [prereq, t])).toBe('in_progress');
  });

  it('blocked when any prereq not done', () => {
    const p1 = task('A', 0, 'done');
    const p2 = task('B', 1000, 'in_progress');
    const t = task('C', 2000, 'todo');
    const edges = [edge('A', 'C'), edge('B', 'C')];
    expect(computeEffectiveStatus(t, edges, [p1, p2, t])).toBe('blocked');
  });
});

// ── computeAllStatuses ────────────────────────────────────────────────────────

describe('computeAllStatuses', () => {
  it('propagates blocked status through chain', () => {
    const a = task('A', 0, 'todo');
    const b = task('B', 1000, 'todo');
    const c = task('C', 2000, 'todo');
    const edges = [edge('A', 'B'), edge('B', 'C')];
    const statuses = computeAllStatuses([a, b, c], edges);
    expect(statuses.get('A')).toBe('todo');   // no prereqs
    expect(statuses.get('B')).toBe('blocked'); // A not done
    expect(statuses.get('C')).toBe('blocked'); // B not done
  });

  it('unblocks when prereq done', () => {
    const a = task('A', 0, 'done');
    const b = task('B', 1000, 'todo');
    const edges = [edge('A', 'B')];
    const statuses = computeAllStatuses([a, b], edges);
    expect(statuses.get('B')).toBe('todo');
  });
});

// ── getCyclicTaskIds ──────────────────────────────────────────────────────────

describe('getCyclicTaskIds', () => {
  it('prereq mode: returns downstream tasks of target', () => {
    // A→B→C. If we're adding task D and trying to select B as prereq of D,
    // C should be safe. But if we ask what's invalid for "D" in prereq mode
    // (i.e. things D can't have as prereq) with existing edges A→B→C,
    // D has no existing edges, so nothing is downstream of D yet.
    const edges = [edge('A', 'B'), edge('B', 'C')];
    // task D is new, nothing downstream of D yet
    const invalid = getCyclicTaskIds('D', edges, 'prereq');
    expect(invalid.size).toBe(0);
  });

  it('dependent mode: returns upstream tasks of target', () => {
    // A→B→C. Task C wants to add a dependent. C's upstream = {A, B}.
    const edges = [edge('A', 'B'), edge('B', 'C')];
    const invalid = getCyclicTaskIds('C', edges, 'dependent');
    expect(invalid.has('A')).toBe(true);
    expect(invalid.has('B')).toBe(true);
    expect(invalid.has('C')).toBe(false);
  });
});

// ── midpointPosition ─────────────────────────────────────────────────────────

describe('midpointPosition', () => {
  it('returns midpoint between two tasks', () => {
    const a = task('A', 1000);
    const b = task('B', 3000);
    expect(midpointPosition(a, b)).toBe(2000);
  });

  it('appends after last task when no "after"', () => {
    const a = task('A', 5000);
    expect(midpointPosition(a, null)).toBe(6000);
  });

  it('prepends before first task when no "before"', () => {
    const b = task('B', 2000);
    expect(midpointPosition(null, b)).toBe(1500);
  });

  it('returns 1000 when both null', () => {
    expect(midpointPosition(null, null)).toBe(1000);
  });
});

// ── reindexPositions ──────────────────────────────────────────────────────────

describe('reindexPositions', () => {
  it('reindexes to even 1000-intervals', () => {
    const tasks = [task('A', 0.001), task('B', 0.002), task('C', 0.003)];
    const reindexed = reindexPositions(tasks);
    expect(reindexed.map(t => t.position)).toEqual([1000, 2000, 3000]);
  });

  it('preserves task identity', () => {
    const tasks = [task('X', 1), task('Y', 2)];
    const reindexed = reindexPositions(tasks);
    expect(reindexed[0].id).toBe('X');
    expect(reindexed[1].id).toBe('Y');
  });
});
