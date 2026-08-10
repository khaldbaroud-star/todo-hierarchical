import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { classifyForStats } from '../logic/taskLogic';

function getRangeStartDate(range) {
  const now = new Date();
  if (range === 'today') {
    now.setHours(0, 0, 0, 0);
    return now;
  }
  if (range === 'week') {
    now.setDate(now.getDate() - 7);
    return now;
  }
  if (range === 'month') {
    now.setMonth(now.getMonth() - 1);
    return now;
  }
  return null;
}

const RANGES = [
  { key: 'today', label: 'اليوم' },
  { key: 'week', label: 'آخر أسبوع' },
  { key: 'month', label: 'آخر شهر' },
  { key: 'all', label: 'كل الوقت' },
];

export default function StatsPage() {
  const [range, setRange] = useState('week');
  const allTasks = useLiveQuery(() => db.tasks.toArray(), []) || [];
  const rangeStart = getRangeStartDate(range);

  function referenceDate(task) {
    const raw = task.completed_at || task.updated_at;
    return raw ? new Date(raw) : null;
  }

  const relevantTasks = allTasks.filter((t) => {
    if (t.status === 'pending') return false;
    if (!rangeStart) return true;
    const ref = referenceDate(t);
    return ref && ref >= rangeStart;
  });

  const counts = { completed: 0, missed_then_completed: 0, abandoned: 0 };
  for (const t of relevantTasks) {
    const category = classifyForStats(t);
    if (category) counts[category] += 1;
  }
  const total = counts.completed + counts.missed_then_completed + counts.abandoned;

  const cards = [
    { key: 'completed', label: 'منجزة في وقتها', color: 'var(--color-growth)', bg: 'var(--color-growth-soft)', value: counts.completed },
    { key: 'missed_then_completed', label: 'ضائعة ثم منجزة', color: 'var(--color-amber)', bg: 'var(--color-amber-soft)', value: counts.missed_then_completed },
    { key: 'abandoned', label: 'متروكة', color: 'var(--color-brick)', bg: 'var(--color-brick-soft)', value: counts.abandoned },
  ];

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px 60px' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, margin: 0 }}>الإحصائيات</h1>
      <p style={{ color: 'var(--color-ink-soft)', marginTop: 4, marginBottom: 28 }}>
        نظرة على ما اكتمل وما تأخّر وما تُرك
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {RANGES.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setRange(opt.key)}
            style={{
              padding: '7px 16px',
              borderRadius: 999,
              border: range === opt.key ? '1px solid var(--color-growth)' : '1px solid var(--color-line)',
              background: range === opt.key ? 'var(--color-growth-soft)' : 'var(--color-surface)',
              color: range === opt.key ? 'var(--color-growth)' : 'var(--color-ink-soft)',
              fontSize: 13,
              fontWeight: range === opt.key ? 600 : 400,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {cards.map((c) => (
          <div
            key={c.key}
            style={{
              flex: '1 1 160px',
              background: c.bg,
              borderRadius: 'var(--radius-lg)',
              padding: 20,
              textAlign: 'center',
            }}
          >
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 34, fontWeight: 600, color: c.color }}>
              {c.value}
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-ink)', marginTop: 6 }}>{c.label}</div>
          </div>
        ))}
      </div>

      <p style={{ marginTop: 24, color: 'var(--color-ink-soft)', fontSize: 13 }}>
        الإجمالي في هذه الفترة: {total} مهمة منتهية (لا تشمل المهام المعلّقة حالياً)
      </p>
    </div>
  );
}
