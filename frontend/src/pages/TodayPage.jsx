import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import TaskTree from '../components/TaskTree';
import QuickAdd from '../components/QuickAdd';
import { createTask, rolloverMissedTasks } from '../logic/taskLogic';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatArabicDate(date) {
  return new Intl.DateTimeFormat('ar', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
}

export default function TodayPage() {
  const rawTasks = useLiveQuery(() => db.tasks.toArray(), []) || [];
  const allTasks = rawTasks.filter((t) => !t.deleted);

  // يشتغل مرة واحدة عند فتح التطبيق: يرحّل أي مهمة متأخرة ليوم اليوم
  useEffect(() => {
    rolloverMissedTasks();
  }, []);

  const today = todayStr();

  // هل لأحد أجداد هذه المهمة ربط مباشر باليوميات اليوم؟ إذا كان كذلك
  // فهي ستظهر أصلاً ضمن شجرة ذلك الجد - لا نعرضها كجذر مكرر
  function hasDailyAncestor(task) {
    let current = task;
    while (current.parent_id) {
      const parent = allTasks.find((p) => p.id === current.parent_id);
      if (!parent) return false;
      if (parent.is_in_daily_list && parent.due_date === today) return true;
      current = parent;
    }
    return false;
  }

  const dailyRootsAll = allTasks.filter(
    (t) => t.due_date === today && t.is_in_daily_list && !hasDailyAncestor(t)
  );
  const dailyRoots = dailyRootsAll.filter((t) => t.status !== 'completed');
  const completedDailyRoots = dailyRootsAll.filter((t) => t.status === 'completed');
  const [showCompleted, setShowCompleted] = useState(false);

  function parentTitleOf(task) {
    if (!task.parent_id) return null;
    const parent = allTasks.find((p) => p.id === task.parent_id);
    return parent ? parent.title : null;
  }

  async function handleAdd({ title }) {
    await createTask({ title, type: 'single', parentId: null, dueDate: today, addToDaily: true });
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px 60px' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, margin: 0 }}>اليوم</h1>
      <p style={{ color: 'var(--color-ink-soft)', marginTop: 4, marginBottom: 28 }}>
        {formatArabicDate(new Date())}
      </p>

      <QuickAdd onAdd={handleAdd} placeholder="اكتب مهمة جديدة واضغط Enter…" />

      <div style={{ marginTop: 6 }}>
        {dailyRoots.length === 0 && (
          <p style={{ color: 'var(--color-ink-soft)', padding: '28px 4px' }}>
            لا مهام مربوطة باليوم بعد. اكتب واحدة بالأعلى، أو اربط مهمة من شاشة المشاريع.
          </p>
        )}
        {dailyRoots.map((t) => (
          <TaskTree key={t.id} task={t} allTasks={allTasks} originLabel={parentTitleOf(t)} />
        ))}
      </div>

      {completedDailyRoots.length > 0 && (
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
            {showCompleted ? '▾' : '◀'} المهام المنجزة اليوم ({completedDailyRoots.length})
          </button>

          {showCompleted && (
            <div style={{ marginTop: 8 }}>
              {completedDailyRoots.map((t) => (
                <TaskTree key={t.id} task={t} allTasks={allTasks} originLabel={parentTitleOf(t)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
