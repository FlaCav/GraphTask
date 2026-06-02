import { useEffect, useRef, useState } from 'react';
import { computeArc, approximateArcLength } from '../../lib/arc';

export interface ArcDef {
  taskId: string;
  startY: number;
  endY: number;
  listLeftX: number;
  color: string; // hex
}

interface Props {
  prereqArcs: ArcDef[];
  dependentArcs: ArcDef[];
  visible: boolean;
  hoveredTaskId?: string | null;
}

interface PathState {
  key: string;
  def: ArcDef;
  length: number;
  d: string;
  active: boolean;
}

export default function ArcCanvas({ prereqArcs, dependentArcs, visible, hoveredTaskId }: Props) {
  const [paths, setPaths] = useState<PathState[]>([]);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (fadeTimer.current) {
      clearTimeout(fadeTimer.current);
      fadeTimer.current = null;
    }

    if (visible) {
      // Rebuild any time visible OR hoveredTaskId OR arc data changes
      const all = [
        ...prereqArcs.map(a => ({ def: a, color: '#9CAEF6' })),
        ...dependentArcs.map(a => ({ def: a, color: '#F69C9C' })),
      ];
      const newPaths: PathState[] = all.map(({ def, color }, i) => {
        const d = computeArc(def.startY, def.endY, def.listLeftX);
        const length = approximateArcLength(def.startY, def.endY, def.listLeftX);
        return {
          key: `${hoveredTaskId ?? 'x'}-${def.taskId}-${i}`,
          def: { ...def, color },
          length,
          d,
          active: false,
        };
      });
      setPaths(newPaths);
      // Activate next frame for animation
      const raf = requestAnimationFrame(() => {
        setPaths(prev => prev.map(p => ({ ...p, active: true })));
      });
      return () => cancelAnimationFrame(raf);
    } else {
      // Fade out then clear
      setPaths(prev => prev.map(p => ({ ...p, active: false })));
      fadeTimer.current = setTimeout(() => setPaths([]), 350);
      return () => {
        if (fadeTimer.current) clearTimeout(fadeTimer.current);
      };
    }
  }, [visible, prereqArcs, dependentArcs, hoveredTaskId]);

  if (paths.length === 0) return null;

  return (
    <svg
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 5 }}
    >
      {paths.map(p => (
        <path
          key={p.key}
          d={p.d}
          fill="none"
          stroke={p.def.color}
          strokeWidth="3"
          strokeLinecap="round"
          style={{
            opacity: p.active ? 1 : 0,
            strokeDasharray: p.length,
            strokeDashoffset: p.active ? 0 : p.length,
            transition: p.active
              ? 'stroke-dashoffset 0.5s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease'
              : 'opacity 0.3s ease',
          }}
        />
      ))}
    </svg>
  );
}
