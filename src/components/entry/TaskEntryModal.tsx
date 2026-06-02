import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { Task } from '../../lib/types';

type Step = 'name' | 'prereqs' | 'dependents' | 'confirm';

interface ChatMessage {
  id: string;
  role: 'bot' | 'user';
  content: React.ReactNode;
}

interface Props {
  graphId: string;
  onClose: () => void;
  onShowToast: (msg: { text: string; type?: 'error' | 'info' | 'success' }) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function msgId() {
  return Math.random().toString(36).slice(2);
}

function BotBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-full bg-[#20dfb9]/15 flex items-center justify-center flex-shrink-0 border border-white shadow-sm">
        <span className="material-symbols-outlined text-[18px] text-[#20dfb9]" style={{ fontVariationSettings: "'FILL' 1" }}>
          auto_awesome
        </span>
      </div>
      <div className="flex flex-col gap-1 items-start max-w-[82%]">
        <p className="text-[#B5B5B5] text-[12px] font-semibold px-1 font-body">Assistant</p>
        <div className="rounded-2xl rounded-tl-none px-5 py-4 bg-[#FDFBF7] text-[#4A4A4A] text-[15px] font-display font-medium leading-relaxed shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="rounded-2xl rounded-tr-none px-5 py-3 bg-[#20dfb9]/10 text-[#17a38a] text-[15px] font-display font-semibold max-w-[82%] leading-relaxed">
        {children}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TaskEntryModal({ graphId, onClose, onShowToast }: Props) {
  const allTasks = useAppStore(s => s.tasks);
  const allEdges = useAppStore(s => s.edges);
  const tasks = useMemo(() => allTasks.filter(t => t.graphId === graphId), [allTasks, graphId]);
  const edges = useMemo(() => allEdges.filter(e => e.graphId === graphId), [allEdges, graphId]);
  const addTask = useAppStore(s => s.addTask);
  const closeEntryModal = useAppStore(s => s.closeEntryModal);

  const [step, setStep] = useState<Step>('name');
  const [taskName, setTaskName] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [prereqIds, setPrereqIds] = useState<Set<string>>(new Set());
  const [dependentIds, setDependentIds] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: msgId(), role: 'bot', content: "What's the task?" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [visible, setVisible] = useState(false);

  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Scroll chat to bottom when messages change
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input after step change
  useEffect(() => {
    if (step === 'name') {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [step]);

  function appendMessage(msg: Omit<ChatMessage, 'id'>) {
    setMessages(prev => [...prev, { ...msg, id: msgId() }]);
  }

  function handleClose() {
    setVisible(false);
    setTimeout(() => { closeEntryModal(); onClose(); }, 300);
  }

  // ── Step 1: name ──────────────────────────────────────────────────────────

  function submitName() {
    const name = inputValue.trim();
    if (!name) return;
    setTaskName(name);
    setInputValue('');
    appendMessage({ role: 'user', content: name });

    if (tasks.length === 0) {
      // Fast path: no other tasks, skip dependency steps
      setTimeout(() => {
        appendMessage({ role: 'bot', content: <>Adding <strong>"{name}"</strong> to the graph.</> });
        doAdd(name, new Set(), new Set());
      }, 250);
      return;
    }

    setTimeout(() => {
      appendMessage({
        role: 'bot',
        content: <>Does <strong>"{name}"</strong> depend on anything already in the list?</>,
      });
      setStep('prereqs');
    }, 250);
  }

  // ── Step 2: prereqs ───────────────────────────────────────────────────────

  function togglePrereq(taskId: string) {
    setPrereqIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  function submitPrereqs(skip = false) {
    const selected = skip ? new Set<string>() : prereqIds;
    const selectedTasks = tasks.filter(t => selected.has(t.id));

    const userMsg = selected.size === 0
      ? 'No prerequisites'
      : selectedTasks.map(t => t.title).join(', ');
    appendMessage({ role: 'user', content: userMsg });

    if (skip) setPrereqIds(new Set());

    setTimeout(() => {
      appendMessage({
        role: 'bot',
        content: <>Does anything already in the list depend on <strong>"{taskName}"</strong>?</>,
      });
      setStep('dependents');
    }, 250);
  }

  // ── Step 3: dependents ────────────────────────────────────────────────────

  // A dependent is invalid if:
  // (a) it's already a selected prereq
  // (b) it can reach any selected prereq (would create cycle through new task)
  const invalidDependentIds = useCallback((): Set<string> => {
    const invalid = new Set<string>();
    // Can't be both prereq and dependent
    prereqIds.forEach(id => invalid.add(id));

    // Build adj for cycle check
    const adj = new Map<string, string[]>();
    for (const e of edges) {
      if (!adj.has(e.sourceId)) adj.set(e.sourceId, []);
      adj.get(e.sourceId)!.push(e.targetId);
    }

    // For each candidate, check if it can reach any prereqId
    for (const t of tasks) {
      if (invalid.has(t.id)) continue;
      const visited = new Set<string>();
      const stack = [t.id];
      let reachesPrereq = false;
      while (stack.length > 0) {
        const cur = stack.pop()!;
        if (prereqIds.has(cur)) { reachesPrereq = true; break; }
        if (visited.has(cur)) continue;
        visited.add(cur);
        for (const next of adj.get(cur) ?? []) stack.push(next);
      }
      if (reachesPrereq) invalid.add(t.id);
    }
    return invalid;
  }, [prereqIds, edges, tasks]);

  function toggleDependent(taskId: string) {
    setDependentIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  function submitDependents(skip = false) {
    const selected = skip ? new Set<string>() : dependentIds;
    const selectedTasks = tasks.filter(t => selected.has(t.id));

    const userMsg = selected.size === 0
      ? 'Nothing depends on it'
      : selectedTasks.map(t => t.title).join(', ');
    appendMessage({ role: 'user', content: userMsg });

    if (skip) setDependentIds(new Set());

    const finalPrereqs = prereqIds;
    const finalDependents = skip ? new Set<string>() : selected;

    // Fast path: both skipped → add immediately
    if (finalPrereqs.size === 0 && finalDependents.size === 0) {
      setTimeout(() => {
        appendMessage({ role: 'bot', content: <>Adding <strong>"{taskName}"</strong> — no dependencies.</> });
        doAdd(taskName, finalPrereqs, finalDependents);
      }, 250);
      return;
    }

    setTimeout(() => {
      const prereqTasks = tasks.filter(t => finalPrereqs.has(t.id));
      const dependentTasks = tasks.filter(t => finalDependents.has(t.id));
      appendMessage({
        role: 'bot',
        content: (
          <div className="space-y-2">
            <p>Adding <strong>"{taskName}"</strong></p>
            {prereqTasks.length > 0 && (
              <p className="text-sm text-[#9CAEF6]">
                ← Blocked by: {prereqTasks.map(t => t.title).join(', ')}
              </p>
            )}
            {dependentTasks.length > 0 && (
              <p className="text-sm text-[#F69C9C]">
                → Blocks: {dependentTasks.map(t => t.title).join(', ')}
              </p>
            )}
            <p className="text-sm text-[#B5B5B5]">Ready to add?</p>
          </div>
        ),
      });
      setStep('confirm');
    }, 250);
  }

  // ── Step 4: confirm / add ─────────────────────────────────────────────────

  async function doAdd(name: string, prereqs: Set<string>, dependents: Set<string>) {
    setSubmitting(true);
    try {
      await addTask(graphId, name, [...prereqs], [...dependents]);
      onShowToast({ text: `Added "${name}"`, type: 'success' });
      handleClose();
    } catch (err) {
      onShowToast({ text: 'Failed to add task.', type: 'error' });
      setSubmitting(false);
    }
  }

  function handleConfirm() {
    doAdd(taskName, prereqIds, dependentIds);
  }

  // ── Input submit ──────────────────────────────────────────────────────────

  function handleInputSubmit() {
    if (step === 'name') submitName();
  }

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleInputSubmit();
    if (e.key === 'Escape') handleClose();
  }

  // ── Pill selection UI ─────────────────────────────────────────────────────

  const invalidDeps = step === 'dependents' ? invalidDependentIds() : new Set<string>();

  function renderSelectionArea() {
    if (step === 'prereqs') {
      return (
        <SelectionArea
          tasks={tasks}
          selected={prereqIds}
          disabledIds={new Set()}
          accentColor="#9CAEF6"
          onToggle={togglePrereq}
          onSubmit={() => submitPrereqs(false)}
          onSkip={() => submitPrereqs(true)}
          submitLabel="Confirm"
          skipLabel="Skip — no prerequisites"
        />
      );
    }
    if (step === 'dependents') {
      return (
        <SelectionArea
          tasks={tasks}
          selected={dependentIds}
          disabledIds={invalidDeps}
          accentColor="#F69C9C"
          onToggle={toggleDependent}
          onSubmit={() => submitDependents(false)}
          onSkip={() => submitDependents(true)}
          submitLabel="Confirm"
          skipLabel="Skip — nothing depends on this"
        />
      );
    }
    if (step === 'confirm') {
      return (
        <div className="flex flex-col gap-3">
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="w-full h-12 rounded-full bg-[#20dfb9] hover:bg-[#1bc6a4] disabled:opacity-50 text-white font-display font-bold text-[15px] shadow-[0_8px_20px_rgba(32,223,185,0.25)] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
          >
            {submitting ? 'Adding…' : 'Add to graph'}
          </button>
          <button
            onClick={handleClose}
            className="w-full h-10 rounded-full text-[#B5B5B5] font-display font-semibold text-sm hover:text-[#4A4A4A] transition-colors"
          >
            Cancel
          </button>
        </div>
      );
    }
    return null;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300"
      style={{
        backgroundColor: visible ? 'rgba(74,74,74,0.4)' : 'transparent',
        backdropFilter: visible ? 'blur(4px)' : 'none',
      }}
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="relative w-full max-w-[520px] flex flex-col bg-white rounded-[24px] shadow-[0_20px_40px_rgba(74,74,74,0.12)] border border-white/50 overflow-hidden transition-all duration-300"
        style={{
          maxHeight: '85vh',
          minHeight: '420px',
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(20px)',
          transitionTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <header className="pt-7 px-8 pb-4 flex justify-between items-center flex-shrink-0 border-b border-[#f0ebe1]/40">
          <h2 className="font-display font-bold text-xl text-[#4A4A4A]">Quick Entry</h2>
          <button
            onClick={handleClose}
            className="p-2 text-[#B5B5B5] hover:text-[#4A4A4A] hover:bg-[#FDFBF7] rounded-full transition-colors"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </header>

        {/* Chat area */}
        <div
          ref={chatRef}
          className="flex-1 overflow-y-auto px-8 py-6 space-y-5"
          style={{ scrollbarWidth: 'none' }}
        >
          {messages.map(msg =>
            msg.role === 'bot'
              ? <BotBubble key={msg.id}>{msg.content}</BotBubble>
              : <UserBubble key={msg.id}>{msg.content}</UserBubble>
          )}

          {/* Inline selection / confirm area */}
          {(step === 'prereqs' || step === 'dependents' || step === 'confirm') && (
            <div className="pt-2">
              {renderSelectionArea()}
            </div>
          )}
        </div>

        {/* Input footer — only on name step */}
        {step === 'name' && (
          <footer className="px-8 pb-8 pt-4 flex-shrink-0">
            <div className="flex items-center rounded-2xl bg-[#FDFBF7] border border-transparent focus-within:border-[#20dfb9]/30 focus-within:ring-4 focus-within:ring-[#20dfb9]/10 transition-all shadow-inner">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="e.g. Design the homepage…"
                className="flex-1 bg-transparent h-14 px-5 text-[#4A4A4A] font-display font-medium text-base placeholder:text-[#B5B5B5] outline-none"
                maxLength={120}
              />
              <div className="pr-4">
                <button
                  onClick={handleInputSubmit}
                  disabled={!inputValue.trim()}
                  className="w-10 h-10 rounded-full bg-[#20dfb9] disabled:opacity-30 text-white flex items-center justify-center shadow-md hover:scale-110 active:scale-95 transition-transform duration-200"
                >
                  <span className="material-symbols-outlined text-[20px]">arrow_upward</span>
                </button>
              </div>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}

// ── Selection area sub-component ──────────────────────────────────────────────

interface SelectionAreaProps {
  tasks: Task[];
  selected: Set<string>;
  disabledIds: Set<string>;
  accentColor: string;
  onToggle: (id: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
  submitLabel: string;
  skipLabel: string;
}

function SelectionArea({
  tasks, selected, disabledIds, accentColor,
  onToggle, onSubmit, onSkip, submitLabel, skipLabel,
}: SelectionAreaProps) {
  return (
    <div className="space-y-3">
      {/* Task pills grid */}
      <div className="flex flex-wrap gap-2">
        {tasks.map(t => {
          const isSelected = selected.has(t.id);
          const isDisabled = disabledIds.has(t.id);

          return (
            <button
              key={t.id}
              disabled={isDisabled}
              onClick={() => onToggle(t.id)}
              className={`h-10 px-4 rounded-full text-sm font-display font-semibold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 ${
                isDisabled
                  ? 'opacity-35 cursor-not-allowed bg-[#FDFBF7] text-[#B5B5B5] border border-gray-100'
                  : isSelected
                    ? 'text-white shadow-sm'
                    : 'bg-[#FDFBF7] text-[#4A4A4A] border border-gray-100 hover:bg-gray-50'
              }`}
              style={isSelected ? { backgroundColor: accentColor } : undefined}
              title={isDisabled ? 'Would create a dependency cycle' : undefined}
            >
              {isSelected && (
                <span className="mr-1.5 text-[13px]">✓</span>
              )}
              {t.title}
            </button>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        {selected.size > 0 && (
          <button
            onClick={onSubmit}
            className="flex-1 h-10 rounded-full font-display font-bold text-sm text-white transition-all duration-200 hover:-translate-y-0.5"
            style={{ backgroundColor: accentColor }}
          >
            {submitLabel} ({selected.size})
          </button>
        )}
        <button
          onClick={onSkip}
          className="flex-1 h-10 rounded-full bg-[#FDFBF7] text-[#B5B5B5] hover:text-[#4A4A4A] font-display font-semibold text-sm border border-gray-100 hover:bg-gray-50 transition-all duration-200"
        >
          {skipLabel}
        </button>
      </div>
    </div>
  );
}
