export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked';

export interface Task {
  id: string;
  graphId: string;
  title: string;
  description: string;
  status: TaskStatus;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface Edge {
  id: string;
  graphId: string;
  sourceId: string; // prerequisite
  targetId: string; // dependent (blocked by source)
}

export interface Graph {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskResource {
  id: string;
  taskId: string;
  label: string;
  url: string;
  kind: 'link' | 'note' | 'file';
}
