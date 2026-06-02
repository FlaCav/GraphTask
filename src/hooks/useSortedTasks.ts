import { useMemo } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { Task } from '../lib/types';
import { topologicalSort } from '../lib/dag';

export function useSortedTasks(graphId: string): Task[] {
  const tasks = useAppStore(s => s.tasks);
  const edges = useAppStore(s => s.edges);
  return useMemo(() => {
    const graphTasks = tasks.filter(t => t.graphId === graphId);
    const graphEdges = edges.filter(e => e.graphId === graphId);
    try {
      return topologicalSort(graphTasks, graphEdges);
    } catch {
      return graphTasks.sort((a, b) => a.position - b.position);
    }
  }, [tasks, edges, graphId]);
}
