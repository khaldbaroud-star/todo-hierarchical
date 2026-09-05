import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_LIST_ID } from '../db/db';
import TaskTree from '../components/TaskTree';
import QuickAdd from '../components/QuickAdd';
import ListDrawer from '../components/ListDrawer';
import { createTask } from '../logic/taskLogic';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function ProjectsPage() {
  const [currentListId, setCurrentListId] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const currentList = useLiveQuery(
    () => (currentListId ? db.lists.get(currentListId) : null),
    [currentListId]
  );

  const rawTasks = useLiveQuery(() => db.tasks.toArray(), []) || [];
  const allTasks = rawTasks.filter((t) => !t.deleted);

  // نتحقق أيضاً من (!t.list_id) للتوافق مع أي مهمة جذرية قديمة قد لا تحمل
  // list_id بعد لسبب ما، حتى لا تختفي بصمت عند عرض القائمة الافتراضية.
  const rootTasksAll = allTasks.filter(
    (t) =>
      !t.parent_id &&
      currentListId !== null &&
      (t.list_id === currentListId || (currentListId === DEFAULT_LIST_ID && !t.list_id))
  );
  const rootTasks = rootTasksAll.filter((t) => t.status !== 'completed');
  const completedRootTasks = rootTasksAll.filter((t) => t.status === 'completed');

  async function handleAdd({ title, type }) {
    await createTask({
      title,
      type,
      parentId: null,
      dueDate: todayStr(),
      addToDaily: false,
      listId: currentListId,
    });
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px 60px' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, margin: 0 }}>المشاريع</h1>
      <p style={{ color: 'var(--color-ink-soft)', marginTop: 4, marginBottom: 28 }}>
        قوائمك المتعشّشة، وكل مهامك بداخلها فردية ومركبة بأي عمق تعشيش
      </p>

      <button
        onClick={() => setDrawerOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '10px 14px',
          marginBottom: 20,
          border: '1px solid var(--color-line)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-surface)',
          fontSize: 15,
          color: 'var(--color-ink)',
        }}
      >
        <span style={{ fontSize: 16, flexShrink: 0 }}>☰</span>
        <span style={{ flex: 1, textAlign: 'right', fontWeight: 600 }}>
          {currentList ? currentList.name : 'اختر قائمة'}
        </span>
        <span style={{ color: 'var(--color-ink-soft)', flexShrink: 0 }}>◀</span>
      </button>

      <ListDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        currentListId={currentListId}
        onNavigate={setCurrentListId}
      />

      {currentListId === null ? (
        <p style={{ color: 'var(--color-ink-soft)', padding: '12px 4px' }}>
          اختر قائمة من الأعلى لعرض مهامها، أو أنشئ قائمة جديدة.
        </p>
      ) : (
        <>
          <QuickAdd allowType onAdd={handleAdd} placeholder="اكتب اسم مهمة أو مشروع جديد…" />

          <div style={{ marginTop: 6 }}>
            {rootTasks.length === 0 && (
              <p style={{ color: 'var(--color-ink-soft)', padding: '28px 4px' }}>
                لا توجد مهام في هذه القائمة بعد.
              </p>
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
        </>
      )}
    </div>
  );
}
