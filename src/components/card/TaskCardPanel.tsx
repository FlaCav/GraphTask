import { useState, useEffect, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../../stores/useAppStore';
import { TaskResource } from '../../lib/types';
import DependencyChip from './DependencyChip';
import TaskResources from './TaskResources';
import DependencyPicker from './DependencyPicker';

interface Props {
  taskId: string;
  graphId: string;
  onClose: () => void;
  onShowToast: (msg: { text: string; type?: 'error' | 'info' | 'success'; undoAction?: () => void }) => void;
}

interface RawResource { id: string; task_id: string; label: string; url: string; kind: string; }

export default function TaskCardPanel({ taskId, graphId, onClose, onShowToast }: Props) {
  const tasks = useAppStore(s => s.tasks);
  const allEdges = useAppStore(s => s.edges);
  const edges = useMemo(() => allEdges.filter(e => e.graphId === graphId), [allEdges, graphId]);
  const effectiveStatus = useAppStore(s => s.effectiveStatus);
  const updateTask = useAppStore(s => s.updateTask);
  const removeTask = useAppStore(s => s.removeTask);
  const addEdge = useAppStore(s => s.addEdge);
  const removeEdge = useAppStore(s => s.removeEdge);
  const setSelectedTask = useAppStore(s => s.setSelectedTask);

  // Local panel state
  const [currentTaskId, setCurrentTaskId] = useState(taskId);
  const [resources, setResources] = useState<TaskResource[]>([]);
  const [pickerMode, setPickerMode] = useState<'prereq' | 'dependent' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [visible, setVisible] = useState(false);

  // Debounced save refs
  const titleSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const descSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  const task = tasks.find(t => t.id === currentTaskId);
  const prereqEdges = edges.filter(e => e.targetId === currentTaskId);
  const dependentEdges = edges.filter(e => e.sourceId === currentTaskId);

  // ── Slide-in on mount ─────────────────────────────────────────────────────

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // ── Load resources ────────────────────────────────────────────────────────

  useEffect(() => {
    invoke<RawResource[]>('get_resources', { taskId: currentTaskId })
      .then(raw => setResources(raw.map(r => ({
        id: r.id, taskId: r.task_id, label: r.label, url: r.url, kind: r.kind as TaskResource['kind']
      }))))
      .catch(console.error);
  }, [currentTaskId]);

  // ── Sync title/desc into contentEditable when task changes ────────────────

  useEffect(() => {
    if (task && titleRef.current && document.activeElement !== titleRef.current) {
      titleRef.current.textContent = task.title;
    }
    if (task && descRef.current && document.activeElement !== descRef.current) {
      descRef.current.value = task.description;
    }
  }, [task, currentTaskId]);

  // ── Title editing ─────────────────────────────────────────────────────────

  function handleTitleInput() {
    const text = titleRef.current?.textContent?.trim() ?? '';
    if (!text) return;
    if (titleSaveTimer.current) clearTimeout(titleSaveTimer.current);
    titleSaveTimer.current = setTimeout(() => {
      updateTask(currentTaskId, { title: text }).catch(console.error);
    }, 600);
  }

  function handleTitleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); titleRef.current?.blur(); }
    if (e.key === 'Escape') { titleRef.current?.blur(); }
  }

  // ── Description editing ───────────────────────────────────────────────────

  function handleDescChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    if (descSaveTimer.current) clearTimeout(descSaveTimer.current);
    descSaveTimer.current = setTimeout(() => {
      updateTask(currentTaskId, { description: text }).catch(console.error);
    }, 600);
    // Auto-grow
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  }

  // ── Navigation between tasks ──────────────────────────────────────────────

  function navigateToTask(nextTaskId: string) {
    setTransitioning(true);
    setTimeout(() => {
      setCurrentTaskId(nextTaskId);
      setSelectedTask(nextTaskId);
      setConfirmDelete(false);
      setPickerMode(null);
      setTransitioning(false);
    }, 180);
  }

  // ── Edge actions ──────────────────────────────────────────────────────────

  async function handleUnlinkPrereq(prereqTaskId: string) {
    const edgeToRemove = prereqEdges.find(e => e.sourceId === prereqTaskId);
    if (!edgeToRemove) return;
    await removeEdge(edgeToRemove.id);
    const prereqTask = tasks.find(t => t.id === prereqTaskId);
    onShowToast({
      text: `Unlinked "${prereqTask?.title ?? prereqTaskId}"`,
      undoAction: () => addEdge(graphId, prereqTaskId, currentTaskId),
    });
  }

  async function handleUnlinkDependent(depTaskId: string) {
    const edgeToRemove = dependentEdges.find(e => e.targetId === depTaskId);
    if (!edgeToRemove) return;
    await removeEdge(edgeToRemove.id);
    const depTask = tasks.find(t => t.id === depTaskId);
    onShowToast({
      text: `Unlinked "${depTask?.title ?? depTaskId}"`,
      undoAction: () => addEdge(graphId, currentTaskId, depTaskId),
    });
  }

  async function handlePickerSelect(selectedTaskId: string) {
    setPickerMode(null);
    if (pickerMode === 'prereq') {
      await addEdge(graphId, selectedTaskId, currentTaskId);
    } else if (pickerMode === 'dependent') {
      await addEdge(graphId, currentTaskId, selectedTaskId);
    }
  }

  // ── Resources ─────────────────────────────────────────────────────────────

  async function handleAddResource(label: string, url: string) {
    const raw = await invoke<RawResource>('add_resource', {
      taskId: currentTaskId, label, url, kind: 'link',
    });
    setResources(prev => [...prev, {
      id: raw.id, taskId: raw.task_id, label: raw.label, url: raw.url, kind: raw.kind as TaskResource['kind']
    }]);
  }

  async function handleRemoveResource(resourceId: string) {
    await invoke('remove_resource', { resourceId });
    setResources(prev => prev.filter(r => r.id !== resourceId));
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete() {
    await removeTask(currentTaskId);
    onClose();
  }

  // ── Close ─────────────────────────────────────────────────────────────────

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 350);
  }

  // ── Created at display ────────────────────────────────────────────────────

  function formatDate(iso: string) {
    try {
      return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso));
    } catch { return ''; }
  }

  if (!task) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 bg-[#4A4A4A]/5 backdrop-blur-[2px] transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
        onClick={handleClose}
      />

      {/* Picker overlay */}
      {pickerMode && (
        <DependencyPicker
          currentTaskId={currentTaskId}
          graphId={graphId}
          mode={pickerMode}
          onSelect={handlePickerSelect}
          onClose={() => setPickerMode(null)}
        />
      )}

      {/* Drawer */}
      <aside
        className="fixed top-0 right-0 z-40 h-full w-full max-w-[480px] flex flex-col bg-white shadow-[0_20px_40px_rgba(74,74,74,0.12)] border-l border-white/50 transition-all duration-[350ms]"
        style={{
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transitionTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)',
          opacity: transitioning ? 0.5 : 1,
          scale: transitioning ? '0.98' : '1',
        }}
      >
        {/* Header */}
        <header className="pt-8 px-8 pb-4 flex justify-between items-start flex-shrink-0">
          <div className="flex-1">
            <h1
              ref={titleRef}
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              onInput={handleTitleInput}
              onKeyDown={handleTitleKeyDown}
              className="font-display font-bold text-[28px] leading-tight text-[#4A4A4A] hover:bg-[#FDFBF7] px-2 -mx-2 rounded-lg transition-colors outline-none focus:bg-[#FDFBF7] cursor-text"
            />
            <p className="text-[#B5B5B5] text-sm font-semibold mt-1 px-2 -mx-2 font-body">
              Created {formatDate(task.createdAt)}
            </p>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="ml-4 p-2 text-[#B5B5B5] hover:text-[#4A4A4A] hover:bg-[#FDFBF7] rounded-full transition-colors flex-shrink-0"
          >
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-8" style={{ scrollbarWidth: 'none' }}>

          {/* Description */}
          <section className="space-y-4">
            <div>
              <label className="font-display font-bold text-lg text-[#4A4A4A] block mb-2">
                Description
              </label>
              <textarea
                ref={descRef}
                defaultValue={task.description}
                onChange={handleDescChange}
                placeholder="Add detailed context or criteria here…"
                rows={4}
                className="w-full resize-none rounded-[16px] text-[#4A4A4A] focus:outline-none focus:ring-2 focus:ring-[#20dfb9]/20 border-none bg-[#FDFBF7] min-h-[120px] placeholder:text-[#B5B5B5] p-4 text-base font-body leading-relaxed shadow-inner overflow-hidden"
                style={{ scrollbarWidth: 'none' }}
              />
            </div>

            {/* Resources */}
            <TaskResources
              resources={resources}
              onAdd={handleAddResource}
              onRemove={handleRemoveResource}
            />
          </section>

          <hr className="border-t border-gray-100" />

          {/* Dependencies */}
          <section className="space-y-6">

            {/* Blocked By (prerequisites) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-lg font-bold text-[#4A4A4A] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#9CAEF6] text-[20px]">arrow_upward</span>
                  Blocked By
                </h3>
                <button
                  onClick={() => setPickerMode('prereq')}
                  className="text-[#B5B5B5] hover:text-[#9CAEF6] transition-colors"
                  title="Add prerequisite"
                >
                  <span className="material-symbols-outlined text-[22px]">add_circle</span>
                </button>
              </div>

              {prereqEdges.length === 0 ? (
                <p className="text-[#B5B5B5] font-body text-sm italic px-1">No prerequisites — this task is free to start.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {prereqEdges.map(e => {
                    const t = tasks.find(t => t.id === e.sourceId);
                    if (!t) return null;
                    return (
                      <DependencyChip
                        key={e.id}
                        task={t}
                        effectiveStatus={effectiveStatus(t.id)}
                        variant="prereq"
                        onNavigate={navigateToTask}
                        onUnlink={handleUnlinkPrereq}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Blocks (dependents) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-lg font-bold text-[#4A4A4A] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#F69C9C] text-[20px]">arrow_downward</span>
                  Blocks
                </h3>
                <button
                  onClick={() => setPickerMode('dependent')}
                  className="text-[#B5B5B5] hover:text-[#F69C9C] transition-colors"
                  title="Add dependent"
                >
                  <span className="material-symbols-outlined text-[22px]">add_circle</span>
                </button>
              </div>

              {dependentEdges.length === 0 ? (
                <p className="text-[#B5B5B5] font-body text-sm italic px-1">Nothing blocked by this task yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {dependentEdges.map(e => {
                    const t = tasks.find(t => t.id === e.targetId);
                    if (!t) return null;
                    return (
                      <DependencyChip
                        key={e.id}
                        task={t}
                        effectiveStatus={effectiveStatus(t.id)}
                        variant="dependent"
                        onNavigate={navigateToTask}
                        onUnlink={handleUnlinkDependent}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="p-6 border-t border-gray-50 bg-white flex-shrink-0 flex justify-center">
          {confirmDelete ? (
            <div className="flex flex-col items-center gap-3 w-full">
              <p className="font-body text-sm text-[#4A4A4A] text-center">
                Remove <strong>"{task.title}"</strong>? Tasks that depended on this will be unblocked.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-full px-5 py-2 text-[#B5B5B5] font-display font-bold text-sm hover:text-[#4A4A4A] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="rounded-full px-5 py-2 bg-red-50 text-red-500 hover:bg-red-100 font-display font-bold text-sm transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-2 text-[#B5B5B5] hover:text-red-400 font-display font-semibold text-sm py-2 px-4 rounded-full transition-colors group"
            >
              <span className="material-symbols-outlined text-[18px] group-hover:rotate-12 transition-transform duration-300">delete</span>
              Remove from graph
            </button>
          )}
        </footer>
      </aside>
    </>
  );
}
