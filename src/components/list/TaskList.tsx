import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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

  function handleHoverEnter(taskId: string) { computeArcs(taskId); }
  function handleHoverLeave() { setArcState(EMPTY_ARC); }

  // ── Drag and drop ───────────────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent, taskId: string) {
    setArcState(EMPTY_ARC);
    setDragTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }

  function handleDrop(e: React.DragEvent, dropIndex: number) {
    e.preventDefault();
    const sourceId = dragTaskId;
    if (!sourceId) return;

    const sourceIndex = sortedTasks.findIndex(t => t.id === sourceId);
    if (sourceIndex === -1 || sourceIndex === dropIndex) {
      setDragTaskId(null); setDragOverIndex(null); return;
    }

    const prereqIds = new Set(edges.filter(e => e.targetId === sourceId).map(e => e.sourceId));
    const dependentIds = new Set(edges.filter(e => e.sourceId === sourceId).map(e => e.targetId));

    let lastPrereqIndex = -1;
    let firstDependentIndex = sortedTasks.length;
    sortedTasks.forEach((t, i) => {
      if (t.id === sourceId) return;
      if (prereqIds.has(t.id)) lastPrereqIndex = Math.max(lastPrereqIndex, i);
      if (dependentIds.has(t.id)) firstDependentIndex = Math.min(firstDependentIndex, i);
    });

    const effectiveDropIndex = dropIndex > sourceIndex ? dropIndex - 1 : dropIndex;
    if (effectiveDropIndex <= lastPrereqIndex) {
      onShowToast({ text: 'Cannot move above a prerequisite task.', type: 'error' });
      setDragTaskId(null); setDragOverIndex(null); return;
    }
    if (effectiveDropIndex >= firstDependentIndex) {
      onShowToast({ text: 'Cannot move below a dependent task.', type: 'error' });
      setDragTaskId(null); setDragOverIndex(null); return;
    }

    const tasksWithoutSource = sortedTasks.filter(t => t.id !== sourceId);
    const before: Task | null = dropIndex > 0 ? (tasksWithoutSource[dropIndex - 1] ?? null) : null;
    const after: Task | null = tasksWithoutSource[dropIndex] ?? null;
    reorderTask(sourceId, midpointPosition(before, after)).catch(() =>
      onShowToast({ text: 'Failed to reorder task.', type: 'error' })
    );
    setDragTaskId(null); setDragOverIndex(null);
  }

  function handleDragEnd() { setDragTaskId(null); setDragOverIndex(null); }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const prereqHighlightIds = new Set(arcState.prereqArcs.map(a => a.taskId));
  const dependentHighlightIds = new Set(arcState.dependentArcs.map(a => a.taskId));
  const arcsVisible = arcState.hoveredTaskId !== null &&
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

      <div ref={containerRef} className="flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {sortedTasks.map((task, index) => (
            <motion.div
              key={task.id}
              layout
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16, scale: 0.95 }}
              transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
            >
              {/* Drop zone indicator */}
              <AnimatePresence>
                {dragTaskId && dragTaskId !== task.id && dragOverIndex === index && (
                  <motion.div
                    initial={{ scaleX: 0, opacity: 0 }}
                    animate={{ scaleX: 1, opacity: 1 }}
                    exit={{ scaleX: 0, opacity: 0 }}
                    className="h-1 rounded-full bg-[#20dfb9]/50 mx-8 mb-2"
                  />
                )}
              </AnimatePresence>

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
                onClick={() => onTaskClick(task.id)}
                draggable={dragTaskId === null}
                onDragStart={e => handleDragStart(e, task.id)}
                onDragOver={e => handleDragOver(e, index)}
                onDrop={e => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                isDragOver={dragOverIndex === index && dragTaskId !== task.id}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Drop zone at end of list */}
        <AnimatePresence>
          {dragTaskId && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onDragOver={e => handleDragOver(e, sortedTasks.length)}
              onDrop={e => handleDrop(e, sortedTasks.length)}
              className="h-12 rounded-full border-2 border-dashed border-[#20dfb9]/30 flex items-center justify-center"
            >
              {dragOverIndex === sortedTasks.length && (
                <span className="text-[#20dfb9]/50 text-sm font-display font-semibold">Drop here</span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
