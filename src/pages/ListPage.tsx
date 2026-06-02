import { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/useAppStore';
import TaskList from '../components/list/TaskList';
import AddTaskFAB from '../components/list/AddTaskFAB';
import TaskCardPanel from '../components/card/TaskCardPanel';
import TaskEntryModal from '../components/entry/TaskEntryModal';
import ToastStack, { useToasts } from '../components/common/Toast';

export default function ListPage() {
  const { graphId } = useParams<{ graphId: string }>();
  const navigate = useNavigate();

  const graphs = useAppStore(s => s.graphs);
  const loadGraph = useAppStore(s => s.loadGraph);
  const renameGraph = useAppStore(s => s.renameGraph);
  const selectedTaskId = useAppStore(s => s.selectedTaskId);
  const setSelectedTask = useAppStore(s => s.setSelectedTask);
  const isEntryModalOpen = useAppStore(s => s.isEntryModalOpen);
  const openEntryModal = useAppStore(s => s.openEntryModal);
  const closeEntryModal = useAppStore(s => s.closeEntryModal);

  const graph = graphs.find(g => g.id === graphId);
  const { toasts, showToast, dismiss } = useToasts();

  // Rename refs
  const titleRef = useRef<HTMLHeadingElement>(null);
  const renameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (graphId) {
      loadGraph(graphId).catch(e => {
        console.error(e);
        showToast({ text: 'Failed to load graph data.', type: 'error' });
      });
    }
  }, [graphId, loadGraph]);

  // Sync title when graph changes (from outside)
  useEffect(() => {
    if (graph && titleRef.current && document.activeElement !== titleRef.current) {
      titleRef.current.textContent = graph.name;
    }
  }, [graph?.name]);

  // Escape: close card panel first, then modal
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (selectedTaskId) setSelectedTask(null);
        else if (isEntryModalOpen) closeEntryModal();
        else if (titleRef.current === document.activeElement) titleRef.current?.blur();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedTaskId, setSelectedTask, isEntryModalOpen, closeEntryModal]);

  // ── Inline rename handlers ──────────────────────────────────────────────────

  function handleTitleInput() {
    const text = titleRef.current?.textContent?.trim();
    if (!text || !graphId) return;
    if (renameTimer.current) clearTimeout(renameTimer.current);
    renameTimer.current = setTimeout(() => {
      renameGraph(graphId, text).catch(() =>
        showToast({ text: 'Failed to rename graph.', type: 'error' })
      );
    }, 600);
  }

  function handleTitleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); titleRef.current?.blur(); }
    if (e.key === 'Escape') { titleRef.current?.blur(); }
  }

  function handleTitleBlur() {
    // Restore if left empty
    if (!titleRef.current?.textContent?.trim() && graph) {
      titleRef.current.textContent = graph.name;
    }
  }

  if (!graphId) return null;

  return (
    <div className="min-h-screen bg-[#FDFBF7] overflow-x-hidden">
      {/* Fixed header */}
      <header className="fixed top-0 left-0 w-full px-6 py-5 z-20 flex items-center justify-between bg-[#FDFBF7]/85 backdrop-blur-md border-b border-[#f0ebe1]/40">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-[#B5B5B5] hover:text-[#4A4A4A] transition-colors font-display font-semibold text-sm"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          Back to Dashboard
        </button>

        {graph && (
          <h1 className="font-display text-lg font-bold text-[#4A4A4A] truncate max-w-[280px]">
            {graph.name}
          </h1>
        )}

        <div className="w-[140px]" />
      </header>

      {/* Main content */}
      <main className="relative max-w-[680px] mx-auto pt-[100px] pb-[160px] px-6 min-h-screen flex flex-col gap-6">
        <div className="mb-2 pt-8">
          {/* Editable graph title */}
          <div className="flex items-center gap-2 group">
            <h1
              ref={titleRef}
              contentEditable
              suppressContentEditableWarning
              spellCheck={false}
              onInput={handleTitleInput}
              onKeyDown={handleTitleKeyDown}
              onBlur={handleTitleBlur}
              className="text-3xl font-bold font-display text-[#4A4A4A] outline-none hover:bg-[#f4f1ea]/60 focus:bg-[#f4f1ea]/60 px-2 -mx-2 rounded-lg transition-colors cursor-text"
              title="Click to rename"
            >
              {graph?.name}
            </h1>
            <span className="material-symbols-outlined text-[18px] text-[#B5B5B5] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              edit
            </span>
          </div>
          <p className="text-[#B5B5B5] mt-1 font-body text-sm font-medium">
            Map out your critical path.
          </p>
        </div>

        <TaskList
          graphId={graphId}
          onTaskClick={taskId => setSelectedTask(taskId)}
          onShowToast={showToast}
        />
      </main>

      {/* FAB */}
      <AddTaskFAB onClick={openEntryModal} dimmed={!!selectedTaskId || isEntryModalOpen} />

      {/* Task card panel */}
      {selectedTaskId && graphId && (
        <TaskCardPanel
          taskId={selectedTaskId}
          graphId={graphId}
          onClose={() => setSelectedTask(null)}
          onShowToast={showToast}
        />
      )}

      {/* Entry modal */}
      {isEntryModalOpen && graphId && (
        <TaskEntryModal
          graphId={graphId}
          onClose={closeEntryModal}
          onShowToast={showToast}
        />
      )}

      {/* Toasts */}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
