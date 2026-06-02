interface Props {
  onClick: () => void;
  dimmed?: boolean;
}

export default function AddTaskFAB({ onClick, dimmed = false }: Props) {
  return (
    <div
      className="fixed bottom-10 inset-x-0 flex justify-center pointer-events-none transition-all duration-300"
      style={{
        zIndex: dimmed ? 20 : 50,
        opacity: dimmed ? 0.35 : 1,
        transform: dimmed ? 'translateY(8px) scale(0.95)' : 'translateY(0) scale(1)',
      }}
    >
      <button
        onClick={onClick}
        className="pointer-events-auto bg-[#20dfb9] text-[#11211e] h-16 px-8 rounded-full shadow-[0_20px_40px_rgba(74,74,74,0.08)] flex items-center gap-3 font-bold text-lg font-display hover:scale-105 active:scale-95 transition-transform duration-300"
        style={{
          transitionTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)',
          pointerEvents: dimmed ? 'none' : 'auto',
        }}
      >
        <span className="material-symbols-outlined text-[24px]">add</span>
        Add Task
      </button>
    </div>
  );
}
