import { useMemo } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { Edge } from '../lib/types';

export function useTaskEdges(taskId: string): { prereqs: Edge[]; dependents: Edge[] } {
  const edges = useAppStore(s => s.edges);
  return useMemo(() => ({
    prereqs: edges.filter(e => e.targetId === taskId),
    dependents: edges.filter(e => e.sourceId === taskId),
  }), [edges, taskId]);
}
