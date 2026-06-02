import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { useAppStore } from '../../stores/useAppStore';
import { useSortedTasks } from '../../hooks/useSortedTasks';
import { midpointPosition } from '../../lib/dag';
import { Task } from '../../lib/types';
import TaskPill from './TaskPill';
import ArcCanvas, { ArcDef } from './ArcCanvas';

interface Props {
  graphId: string;
  onTaskClick: (taskId: string) => void;
  onShowToast: (msg: { text: string; type?: 'error' | 'info' | 'success'; undoAction?: () => void }) => void;
}

interface ArcState {
  prereqArcs: ArcDef[];
  dependentArcs: ArcDef[];
  hoveredTaskId: string | null;
}

const EMPTY_ARC: ArcState = { prereqArcs: [], dependentArcs: [], hoveredTaskId: null };

export default function TaskList({ graphId, onTaskClick, onShowToast }: Props) {
  const sortedTasks = useSortedTasks(graphId);
  const allEdges = useAppStore(s => s.edges);
  const edges = useMemo(() => allEdges.filter(e => e.graphId === graphId), [allEdges, graphId]);
  const effectiveStatus = useAppStore(s => s.effectiveStatus);
  const reorderTask = useAppStore(s => s.reorderTask);

  const pillRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const [arcState, setArcState] = useState<ArcState>(EMPTY_ARC);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  // Local copy of order that we mutate during a drag.
  // Synced from sortedTasks whenever the store updates (and we're not mid-drag).
  const [localOrder, setLocalOrder] = useState<Task[]>(sortedTasks);
  useEffect(() => {
    if (!draggingTaskId) setLocalOrder(sortedTasks);
  }, [sortedTasks, draggingTaskId]);

  // Clear arcs on window resize (positions would be stale)
  useEffect(() => {
    function onResize() { setArcState(EMPTY_ARC); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Arc computation ─────────────────────────────────────────────────────────

  const computeArcs = useCallback((taskId: string) => {
    const prereqEdges = edges.filter(e => e.targetId === taskId);
    const dependentEdges = edges.filter(e => e.sourceId === taskId);
    if (prereqEdges.length === 0 && dependentEdges.length === 0) return;

    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    const listLeftX = containerRect.left;

    function toArcDef(relatedTaskId: string, color: string): ArcDef | null {
      const hoveredEl = pillRefs.current.get(taskId);
      const relatedEl = pillRefs.current.get(relatedTaskId);
      if (!hoveredEl || !relatedEl) return null;
      const hRect = hoveredEl.getBoundingClientRect();
      const rRect = relatedEl.getBoundingClientRect();
      return {
        taskId: relatedTaskId,
        startY: hRect.top + hRect.height / 2,
        endY: rRect.top + rRect.height / 2,
        listLeftX,
        color,
      };
    }

    const prereqArcs = prereqEdges.map(e => toArcDef(e.sourceId, '#9CAEF6')).filter(Boolean) as ArcDef[];
    const dependentArcs = dependentEdges.map(e => toArcDef(e.targetId, '#F69C9C')).filter(Boolean) as ArcDef[];
    setArcState({ prereqArcs, dependentArcs, hoveredTaskId: taskId });
  }, [edges]);

  function handleHoverEnter(taskId: string) {
    if (draggingTaskId) return;
    computeArcs(taskId);
  }
  function handleHoverLeave() { setArcState(EMPTY_ARC); }

  // ── Drag commit ─────────────────────────────────────────────────────────────

  function commitReorder(movedTaskId: string) {
    setDraggingTaskId(null);

    const newIndex = localOrder.findIndex(t => t.id === movedTaskId);
    const oldIndex = sortedTasks.findIndex(t => t.id === movedTaskId);
    if (newIndex === -1 || oldIndex === -1 || newIndex === oldIndex) {
      // No change — re-sync localOrder to canonical sortedTasks
      setLocalOrder(sortedTasks);
      return;
    }

    // DAG validation: can't move above any prereq or below any dependent
    const prereqIds = new Set(edges.filter(e => e.targetId === movedTaskId).map(e => e.sourceId));
    const dependentIds = new Set(edges.filter(e => e.sourceId === movedTaskId).map(e => e.targetId));

    let lastPrereqIdx = -1;
    let firstDependentIdx = localOrder.length;
    localOrder.forEach((t, i) => {
      if (t.id === movedTaskId) return;
      if (prereqIds.has(t.id)) lastPrereqIdx = Math.max(lastPrereqIdx, i);
      if (dependentIds.has(t.id)) firstDependentIdx = Math.min(firstDependentIdx, i);
    });

    if (newIndex <= lastPrereqIdx) {
      onShowToast({ text: 'Cannot move above a prerequisite task.', type: 'error' });
      setLocalOrder(sortedTasks);
      return;
    }
    if (newIndex >= firstDependentIdx) {
      onShowToast({ text: 'Cannot move below a dependent task.', type: 'error' });
      setLocalOrder(sortedTasks);
      return;
    }

    const before: Task | null = newIndex > 0 ? (localOrder[newIndex - 1] ?? null) : null;
    const after: Task | null = newIndex < localOrder.length - 1
      ? (localOrder[newIndex + 1] ?? null)
      : null;
    const beforeFiltered = before?.id === movedTaskId ? null : before;
    const afterFiltered = after?.id === movedTaskId ? null : after;

    reorderTask(movedTaskId, midpointPosition(beforeFiltered, afterFiltered)).catch(() => {
      onShowToast({ text: 'Failed to reorder task.', type: 'error' });
      setLocalOrder(sortedTasks);
    });
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const prereqHighlightIds = new Set(arcState.prereqArcs.map(a => a.taskId));
  const dependentHighlightIds = new Set(arcState.dependentArcs.map(a => a.taskId));
  const arcsVisible = !draggingTaskId && arcState.hoveredTaskId !== null &&
    (arcState.prereqArcs.length > 0 || arcState.dependentArcs.length > 0);

  // ── Empty state ──────────────────────────────────────────────────────────────

  if (sortedTasks.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-24 text-center"
      >
        <div className="w-32 h-32 rounded-full bg-[#f4f1ea] flex items-center justify-center mb-6">
          <span className="material-symbols-outlined text-[56px] text-[#20dfb9]/40">checklist</span>
        </div>
        <p className="font-display text-xl font-bold text-[#4A4A4A] mb-2">No tasks yet.</p>
        <p className="font-body text-sm text-[#B5B5B5]">Tap "Add Task" to get started.</p>
      </motion.div>
    );
  }

  return (
    <>
      <ArcCanvas
        prereqArcs={arcState.prereqArcs}
        dependentArcs={arcState.dependentArcs}
        visible={arcsVisible}
        hoveredTaskId={arcState.hoveredTaskId}
      />

      <Reorder.Group
        ref={containerRef as unknown as React.RefObject<HTMLDivElement>}
        axis="y"
        values={localOrder}
        onReorder={setLocalOrder}
        as="div"
        className="flex flex-col gap-3"
      >
        <AnimatePresence initial={false}>
          {localOrder.map((task) => (
            <Reorder.Item
              key={task.id}
              value={task}
              as="div"
              dragListener={true}
              onDragStart={() => {
                setArcState(EMPTY_ARC);
                setDraggingTaskId(task.id);
              }}
              onDragEnd={() => commitReorder(task.id)}
              style={{ touchAction: 'none' }}
              whileDrag={{ scale: 1.03, zIndex: 10 }}
            >
              <TaskPill
                ref={el => {
                  if (el) pillRefs.current.set(task.id, el);
                  else pillRefs.current.delete(task.id);
                }}
                task={task}
                effectiveStatus={effectiveStatus(task.id)}
                isHovered={arcState.hoveredTaskId === task.id}
                prereqHighlight={prereqHighlightIds.has(task.id)}
                dependentHighlight={dependentHighlightIds.has(task.id)}
                onHoverEnter={() => handleHoverEnter(task.id)}
                onHoverLeave={handleHoverLeave}
                onClick={() => {
                  if (!draggingTaskId) onTaskClick(task.id);
                }}
                isDragging={draggingTaskId === task.id}
              />
            </Reorder.Item>
          ))}
        </AnimatePresence>
      </Reorder.Group>
    </>
  );
}
