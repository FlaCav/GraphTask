import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Graph } from '../../lib/types';
import { useAppStore } from '../../stores/useAppStore';
import { computeAllStatuses } from '../../lib/dag';

interface Props {
  graph: Graph;
  onDeleted?: () => void;
}

export default function GraphCard({ graph, onDeleted }: Props) {
  const navigate = useNavigate();
  const tasks = useAppStore(s => s.tasks);
  const edges = useAppStore(s => s.edges);
  const deleteGraph = useAppStore(s => s.deleteGraph);
  const progress = useMemo(() => {
    const graphTasks = tasks.filter(t => t.graphId === graph.id);
    const graphEdges = edges.filter(e => e.graphId === graph.id);
    const statuses = computeAllStatuses(graphTasks, graphEdges);
    const done = [...statuses.values()].filter(s => s === 'done').length;
    return { done, total: graphTasks.length };
  }, [tasks, edges, graph.id]);
  const percent = progress.total === 0 ? 0 : (progress.done / progress.total) * 100;
  const dashArray = `${percent.toFixed(1)}, 100`;

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hovering, setHovering] = useState(false);

  function handleClick(e: React.MouseEvent) {
    if (confirmDelete) return;
    navigate(`/graph/${graph.id}`);
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setDeleting(true);
    try {
      await deleteGraph(graph.id);
      onDeleted?.();
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
      onClick={handleClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => { setHovering(false); setConfirmDelete(false); }}
      whileHover={{ y: -4 }}
      className="w-full max-w-[320px] bg-white rounded-[24px] p-6 flex flex-col justify-between h-[180px] shadow-sm hover:shadow-[0_20px_40px_rgba(74,74,74,0.08)] transition-shadow duration-300 cursor-pointer group border border-[#f0ebe1]/50 relative overflow-hidden"
      style={{ transitionTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)' }}
    >
      {/* Delete button — top right, visible on hover */}
      <AnimatePresence>
        {hovering && !confirmDelete && (
          <motion.button
            key="del-btn"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.15 }}
            onClick={e => { e.stopPropagation(); setConfirmDelete(true); }}
            className="absolute top-4 right-4 w-7 h-7 rounded-full bg-[#f4f1ea] text-[#B5B5B5] hover:bg-red-50 hover:text-red-400 flex items-center justify-center transition-colors z-10"
            title="Delete graph"
          >
            <span className="material-symbols-outlined text-[16px]">delete</span>
          </motion.button>
        )}

        {/* Confirm delete overlay */}
        {confirmDelete && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-[24px] flex flex-col items-center justify-center gap-3 px-5 z-10"
            onClick={e => e.stopPropagation()}
          >
            <p className="font-display font-bold text-sm text-[#4A4A4A] text-center leading-snug">
              Delete "{graph.name}"?
            </p>
            <p className="font-body text-xs text-[#B5B5B5] text-center">All tasks will be removed.</p>
            <div className="flex gap-2">
              <button
                onClick={e => { e.stopPropagation(); setConfirmDelete(false); }}
                className="rounded-full px-4 py-1.5 text-[#B5B5B5] font-display font-bold text-xs hover:text-[#4A4A4A] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-full px-4 py-1.5 bg-red-50 text-red-500 hover:bg-red-100 font-display font-bold text-xs transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top row: title + progress ring */}
      <div className="flex justify-between items-start">
        <h2 className="text-[#4A4A4A] text-xl font-bold leading-tight font-display pr-4 group-hover:text-[#20dfb9] transition-colors line-clamp-2">
          {graph.name}
        </h2>

        <div className="relative w-12 h-12 flex-shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-[#F5F3ED] stroke-current"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none" strokeWidth="3"
            />
            <path
              className="text-[#20dfb9] stroke-current"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              strokeDasharray={dashArray}
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      {/* Bottom row: task count + arrow */}
      <div className="flex items-center justify-between mt-auto">
        <p className="text-[#B5B5B5] text-sm font-medium font-body">
          {progress.done}/{progress.total} task{progress.total !== 1 ? 's' : ''}
        </p>
        <span className="material-symbols-outlined text-[#B5B5B5] opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-x-2 group-hover:translate-x-0"
          style={{ transitionTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)' }}>
          arrow_forward
        </span>
      </div>
    </motion.div>
  );
}
