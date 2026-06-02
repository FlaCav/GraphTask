import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from './stores/useAppStore';
import DashboardPage from './pages/DashboardPage';
import ListPage from './pages/ListPage';

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
};

const pageTransition = {
  duration: 0.28,
  ease: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
};

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransition}
        style={{ minHeight: '100vh' }}
      >
        <Routes location={location}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/graph/:graphId" element={<ListPage />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  const loadGraphs = useAppStore(s => s.loadGraphs);

  useEffect(() => {
    loadGraphs().catch(console.error);
  }, [loadGraphs]);

  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  );
}
