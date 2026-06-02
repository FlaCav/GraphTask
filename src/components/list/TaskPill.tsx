import { forwardRef } from 'react';
import { Task, TaskStatus } from '../../lib/types';
import { useAppStore } from '../../stores/useAppStore';

interface Props {
  task: Task;
  effectiveStatus: TaskStatus;
  isHovered: boolean;
  prereqHighlight: boolean;   // periwinkle border — this task is a prereq of hovered
  dependentHighlight: boolean; // coral border — this task is a dependent of hovered
  onHoverEnter: () => void;
  onHoverLeave: () => void;
  onClick: () => void;
  isDragging?: boolean;
}

const STATUS_ICON: Record<TaskStatus, string> = {
  todo: 'radio_button_unchecked',
  in_progress: 'timelapse',
  done: 'check_circle',
  blocked: 'block',
};

const STATUS_ICON_COLOR: Record<TaskStatus, string> = {
  todo: 'text-[#B5B5B5] bg-[#f4f1ea]',
  in_progress: 'text-[#20dfb9] bg-[#20dfb9]/10',
  done: 'text-[#20dfb9] bg-[#20dfb9]/15',
  blocked: 'text-[#F69C9C] bg-[#F69C9C]/10',
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
  blocked: 'Blocked',
};

const STATUS_BADGE: Record<TaskStatus, string> = {
  todo: 'bg-[#f4f1ea] text-[#B5B5B5]',
  in_progress: 'bg-[#20dfb9]/10 text-[#17a38a]',
  done: 'bg-[#f4f1ea] text-[#B5B5B5]',
  blocked: 'bg-[#F69C9C]/15 text-[#c0504a]',
};

const TaskPill = forwardRef<HTMLDivElement, Props>(({
  task,
  effectiveStatus,
  isHovered,
  prereqHighlight,
  dependentHighlight,
  onHoverEnter,
  onHoverLeave,
  onClick,
  isDragging = false,
}, ref) => {
  const cycleTaskStatus = useAppStore(s => s.cycleTaskStatus);

  function handleStatusClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (effectiveStatus !== 'blocked') {
      cycleTaskStatus(task.id);
    }
  }

  // Border color: highlight > hover > default
  let borderStyle = 'border-[#f0ebe1]/60';
  if (prereqHighlight) borderStyle = 'border-[#9CAEF6]';
  else if (dependentHighlight) borderStyle = 'border-[#F69C9C]';
  else if (isHovered) borderStyle = 'border-[#20dfb9]/30';

  return (
    <div
      ref={ref}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
      onClick={onClick}
      className={`
        relative bg-white h-[80px] rounded-full shadow-[0_4px_16px_rgba(158,188,182,0.12)]
        flex items-center justify-between px-6 cursor-grab active:cursor-grabbing
        border transition-all duration-[400ms] select-none
        ${borderStyle}
        ${isHovered && !isDragging ? 'shadow-[0_20px_40px_rgba(74,74,74,0.08)] translate-x-2 bg-[#F8FDFB]' : ''}
        ${isDragging ? 'opacity-90 shadow-[0_30px_60px_rgba(74,74,74,0.15)]' : ''}
      `}
      style={{ transitionTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)' }}
    >
      {/* Left: status icon + title */}
      <div className="flex items-center gap-4 min-w-0">
        <button
          onClick={handleStatusClick}
          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 ${STATUS_ICON_COLOR[effectiveStatus]} ${effectiveStatus !== 'blocked' ? 'hover:scale-110 active:scale-95' : ''}`}
          title={`Status: ${STATUS_LABEL[effectiveStatus]}${effectiveStatus !== 'blocked' ? ' — click to cycle' : ''}`}
        >
          <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            {STATUS_ICON[effectiveStatus]}
          </span>
        </button>

        <h2 className="text-[#4A4A4A] text-[17px] font-bold font-display truncate">
          {task.title}
        </h2>
      </div>

      {/* Right: status badge */}
      <div className={`flex-shrink-0 ml-4 px-4 py-1.5 rounded-full text-sm font-bold font-display ${STATUS_BADGE[effectiveStatus]}`}>
        {STATUS_LABEL[effectiveStatus]}
      </div>
    </div>
  );
});

TaskPill.displayName = 'TaskPill';
export default TaskPill;
