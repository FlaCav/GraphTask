import { useState } from 'react';
import { Task, TaskStatus } from '../../lib/types';

interface Props {
  task: Task;
  effectiveStatus: TaskStatus;
  variant: 'prereq' | 'dependent';
  onNavigate: (taskId: string) => void;
  onUnlink: (taskId: string) => void;
}

const STATUS_ICON: Record<TaskStatus, string> = {
  todo: 'radio_button_unchecked',
  in_progress: 'timelapse',
  done: 'check_circle',
  blocked: 'block',
};

export default function DependencyChip({ task, effectiveStatus, variant, onNavigate, onUnlink }: Props) {
  const [hovering, setHovering] = useState(false);

  const isPrereq = variant === 'prereq';
  const bg = isPrereq
    ? 'bg-[#9CAEF6]/10 hover:bg-[#9CAEF6]/20 border-[#9CAEF6]/20'
    : 'bg-[#F69C9C]/10 hover:bg-[#F69C9C]/20 border-[#F69C9C]/20';
  const iconBg = isPrereq ? 'bg-[#9CAEF6]/20 text-[#9CAEF6]' : 'bg-[#F69C9C]/20 text-[#F69C9C]';
  const textColor = isPrereq ? 'text-[#4a5578]' : 'text-[#8c5050]';

  return (
    <div
      className={`w-full text-left border rounded-[12px] p-3 flex items-center gap-3 transition-all duration-300 group cursor-pointer ${bg}`}
      style={{ transitionTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)' }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={() => onNavigate(task.id)}
      onMouseMove={e => { if ((e.currentTarget.style.transform = 'translateY(-2px)') && false) {} }}
    >
      {/* Status icon */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform ${iconBg}`}>
        <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
          {STATUS_ICON[effectiveStatus]}
        </span>
      </div>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <p className={`font-body font-semibold text-sm truncate ${textColor} ${effectiveStatus === 'done' ? 'line-through opacity-70' : ''}`}>
          {task.title}
        </p>
      </div>

      {/* Actions: unlink × (on hover) or navigate chevron */}
      {hovering ? (
        <button
          onClick={e => { e.stopPropagation(); onUnlink(task.id); }}
          className="w-7 h-7 rounded-full flex items-center justify-center text-[#B5B5B5] hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0"
          title="Unlink"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      ) : (
        <span className="material-symbols-outlined text-[#B5B5B5] opacity-0 group-hover:opacity-100 transition-opacity text-[18px] flex-shrink-0">
          chevron_right
        </span>
      )}
    </div>
  );
}
