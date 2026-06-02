interface Props {
  onCreateGraph: () => void;
}

export default function EmptyState({ onCreateGraph }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-48 h-48 mb-8 rounded-full bg-[#f4f1ea] flex items-center justify-center">
        <span className="material-symbols-outlined text-[80px] text-[#20dfb9]/50">
          account_tree
        </span>
      </div>
      <h3 className="text-2xl font-bold font-display text-[#4A4A4A] mb-2">
        No graphs yet.
      </h3>
      <p className="text-[#B5B5B5] font-body text-base max-w-sm mb-8">
        Start connecting tasks and building your workflow by creating a new graph.
      </p>
      <button
        onClick={onCreateGraph}
        className="flex items-center gap-2 rounded-full h-[48px] px-6 bg-[#20dfb9] hover:bg-[#1bc6a4] text-white text-[15px] font-bold font-display shadow-[0_12px_32px_rgba(32,223,185,0.15)] transition-all duration-300"
        style={{ transitionTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)' }}
      >
        <span className="material-symbols-outlined text-[20px]">add</span>
        Create your first graph
      </button>
    </div>
  );
}
