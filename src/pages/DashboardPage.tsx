import { useState } from 'react';
import { useAppStore } from '../stores/useAppStore';
import GraphCardGrid from '../components/dashboard/GraphCardGrid';
import EmptyState from '../components/dashboard/EmptyState';
import CreateGraphModal from '../components/dashboard/CreateGraphModal';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning.';
  if (h < 17) return 'Good afternoon.';
  return 'Good evening.';
}

export default function DashboardPage() {
  const graphs = useAppStore(s => s.graphs);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      <div className="px-8 md:px-16 lg:px-40 flex flex-1 justify-center py-5">
        <div className="flex flex-col w-full max-w-[1080px] flex-1 gap-8 pt-8">

          {/* Header */}
          <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 px-4 pt-12 pb-6 min-h-[120px]">
            <div className="flex flex-col gap-2">
              <p className="text-[#B5B5B5] text-sm font-semibold tracking-wider uppercase font-body">
                Dashboard
              </p>
              <h1 className="text-[#4A4A4A] text-[32px] font-bold leading-tight tracking-[-0.02em] font-display">
                {greeting()}
              </h1>
            </div>

            <button
              onClick={() => setModalOpen(true)}
              className="group flex items-center justify-center gap-2 rounded-full h-[48px] px-6 bg-[#20dfb9] hover:bg-[#1bc6a4] text-white text-[15px] font-bold font-display shadow-[0_12px_32px_rgba(32,223,185,0.15)] hover:shadow-[0_20px_40px_rgba(74,74,74,0.08)] transition-all duration-300"
              style={{ transitionTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-4px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              <span>Create Graph</span>
            </button>
          </header>

          {/* Main content */}
          <main className="w-full px-4 pb-20">
            {graphs.length === 0 ? (
              <EmptyState onCreateGraph={() => setModalOpen(true)} />
            ) : (
              <GraphCardGrid graphs={graphs} />
            )}
          </main>
        </div>
      </div>

      <CreateGraphModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
