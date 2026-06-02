import { useMemo, useEffect } from 'react';
import { wouldCreateCycle } from '../../lib/dag';
import { useAppStore } from '../../stores/useAppStore';

interface Props {
  currentTaskId: string;
  graphId: string;
  mode: 'prereq' | 'dependent';
  onSelect: (taskId: string) => void;
  onClose: () => void;
}

export default function DependencyPicker({ currentTaskId, graphId, mode, onSelect, onClose }: Props) {
  const allTasks = useAppStore(s => s.tasks);
  const allEdges = useAppStore(s => s.edges);
  const tasks = useMemo(
    () => allTasks.filter(t => t.graphId === graphId && t.id !== currentTaskId),
    [allTasks, graphId, currentTaskId]
  );
  const edges = useMemo(
    () => allEdges.filter(e => e.graphId === graphId),
    [allEdges, graphId]
  );
  const effectiveStatus = useAppStore(s => s.effectiveStatus);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Already linked IDs
  const alreadyLinked = useMemo(() => {
    const linked = new Set<string>();
    if (mode === 'prereq') {
      edges.filter(e => e.targetId === currentTaskId).forEach(e => linked.add(e.sourceId));
    } else {
      edges.filter(e => e.sourceId === currentTaskId).forEach(e => linked.add(e.targetId));
    }
    return linked;
  }, [edges, currentTaskId, mode]);

  // Cycle-safe candidates
  const candidates = useMemo(() => {
    return tasks.map(t => {
      const sourceId = mode === 'prereq' ? t.id : currentTaskId;
      const targetId = mode === 'prereq' ? currentTaskId : t.id;
      const cyclic = wouldCreateCycle(sourceId, targetId, edges);
      const linked = alreadyLinked.has(t.id);
      return { task: t, disabled: cyclic || linked, reason: linked ? 'Already linked' : cyclic ? 'Would create cycle' : null };
    });
  }, [tasks, edges, currentTaskId, mode, alreadyLinked]);

  const isPrereq = mode === 'prereq';
  const accent = isPrereq ? '#9CAEF6' : '#F69C9C';
  const accentText = isPrereq ? 'text-[#4a5578]' : 'text-[#8c5050]';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-end sm:justify-end"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[20px] shadow-[0_20px_40px_rgba(74,74,74,0.12)] w-full max-w-[440px] mx-4 mb-4 sm:mb-0 sm:mr-8 p-6 max-h-[60vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-[#4A4A4A] text-lg">
            {isPrereq ? 'Add prerequisite' : 'Add dependent'}
          </h3>
          <button onClick={onClose} className="p-1.5 text-[#B5B5B5] hover:text-[#4A4A4A] rounded-full hover:bg-[#f4f1ea] transition-colors">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <p className="font-body text-sm text-[#B5B5B5] mb-4">
          {isPrereq ? 'This task will be blocked until the selected task is done.' : 'The selected task will be blocked until this task is done.'}
        </p>

        <div className="overflow-y-auto flex flex-col gap-2 hide-scrollbar">
          {candidates.length === 0 && (
            <p className="text-center text-[#B5B5B5] font-body text-sm py-6">No other tasks in this graph.</p>
          )}
          {candidates.map(({ task, disabled, reason }) => {
            const status = effectiveStatus(task.id);
            return (
              <button
                key={task.id}
                disabled={disabled}
                onClick={() => onSelect(task.id)}
                className={`w-full text-left rounded-[12px] p-3 flex items-center gap-3 transition-all duration-200 border ${
                  disabled
                    ? 'opacity-40 cursor-not-allowed bg-[#f4f1ea] border-transparent'
                    : `bg-[${accent}]/10 hover:bg-[${accent}]/20 border-[${accent}]/20 hover:-translate-y-0.5`
                }`}
                title={reason ?? undefined}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${accent}25` }}>
                  <span className="material-symbols-outlined text-[16px]" style={{ color: accent, fontVariationSettings: "'FILL' 1" }}>
                    {status === 'done' ? 'check_circle' : status === 'blocked' ? 'block' : status === 'in_progress' ? 'timelapse' : 'radio_button_unchecked'}
                  </span>
                </div>
                <p className={`font-body font-semibold text-sm flex-1 truncate ${accentText}`}>{task.title}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
