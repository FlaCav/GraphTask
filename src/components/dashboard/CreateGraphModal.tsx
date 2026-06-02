import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { useNavigate } from 'react-router-dom';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CreateGraphModal({ open, onClose }: Props) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const createGraph = useAppStore(s => s.createGraph);
  const loadGraph = useAppStore(s => s.loadGraph);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setName('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const graph = await createGraph(trimmed);
      await loadGraph(graph.id);
      onClose();
      navigate(`/graph/${graph.id}`);
    } finally {
      setLoading(false);
    }
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#4A4A4A]/10 backdrop-blur-[2px]"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-[24px] shadow-[0_20px_40px_rgba(74,74,74,0.12)] w-full max-w-md mx-4 p-8">
        <h2 className="font-display text-2xl font-bold text-[#4A4A4A] mb-2">
          New Graph
        </h2>
        <p className="font-body text-sm text-[#B5B5B5] mb-6">
          Give your task graph a name to get started.
        </p>

        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Website Redesign"
            className="w-full rounded-full px-5 py-3 bg-[#f4f1ea] text-[#4A4A4A] font-body text-base placeholder:text-[#B5B5B5] outline-none focus:ring-2 focus:ring-[#20dfb9]/30 transition-all mb-6"
            maxLength={80}
            disabled={loading}
            onKeyDown={e => e.key === 'Escape' && onClose()}
          />

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-5 py-2.5 text-[#B5B5B5] font-display font-bold text-sm hover:text-[#4A4A4A] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || loading}
              className="rounded-full px-6 py-2.5 bg-[#20dfb9] hover:bg-[#1bc6a4] disabled:opacity-40 text-white font-display font-bold text-sm shadow-[0_8px_20px_rgba(32,223,185,0.2)] transition-all duration-200"
            >
              {loading ? 'Creating…' : 'Create Graph'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
