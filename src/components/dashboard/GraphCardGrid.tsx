import { AnimatePresence } from 'framer-motion';
import { Graph } from '../../lib/types';
import GraphCard from './GraphCard';

interface Props {
  graphs: Graph[];
}

export default function GraphCardGrid({ graphs }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center sm:justify-items-stretch">
      <AnimatePresence>
        {graphs.map(graph => (
          <GraphCard key={graph.id} graph={graph} />
        ))}
      </AnimatePresence>
    </div>
  );
}
