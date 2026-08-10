import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import TaskTree from '../components/TaskTree';
import QuickAdd from '../components/QuickAdd';
import { createTask } from '../logic/taskLogic';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function ProjectsPage() {
  const rawTasks = useLiveQuery(() => db.tasks.toArray(), []) || [];
  const allTasks = rawTasks.filter((t) => !t.deleted);
  const rootTasksAll = allTasks.filter((t) => !t.parent_id);
  const rootTasks = rootTasksAll.filter((t) => t.status !== 'completed');
  const completedRootTasks = rootTasksAll.filter((t) => t.status === 'completed');
  const [showCompleted, setShowCompleted] = useState(false);

  async function handleAdd({ title, type }) {
    await createTask({ title, type, parentId: null, dueDate: todayStr(), addToDaily: false });
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px 60px' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, margin: 0 }}>المشاريع</h1>
      <p style={{ color: 'var(--color-ink-soft)', marginTop: 4, marginBottom: 28 }}>
        كل مهامك، فردية ومركبة، بأي عمق تعشيش
      </p>

      <QuickAdd allowType onAdd={handleAdd} placeholder="اكتب اسم مهمة أو مشروع جديد…" />

      <div style={{ marginTop: 6 }}>
        {rootTasks.length === 0 && (
          <p style={{ color: 'var(--color-ink-soft)', padding: '28px 4px' }}>لا توجد مهام بعد.</p>
        )}
        {rootTasks.map((t) => (
          <TaskTree key={t.id} task={t} allTasks={allTasks} />
        ))}
      </div>

      {completedRootTasks.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <button
            onClick={() => setShowCompleted((v) => !v)}
            style={{
              border: 'none',
              background: 'none',
              color: 'var(--color-ink-soft)',
              fontSize: 13,
              padding: '4px 4px',
            }}
          >
            {showCompleted ? '▾' : '◀'} المهام المنجزة ({completedRootTasks.length})
          </button>

          {showCompleted && (
            <div style={{ marginTop: 8 }}>
              {completedRootTasks.map((t) => (
                <TaskTree key={t.id} task={t} allTasks={allTasks} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
