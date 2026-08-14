import { useState } from 'react';

/**
 * شريط تبديل بين القوائم (أعلى شاشة المشاريع) + زر لإنشاء قائمة جديدة.
 */
export default function ListSwitcher({ lists, selectedListId, onSelect, onCreate }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setName('');
    setCreating(false);
  }

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
      {lists.map((list) => (
        <button
          key={list.id}
          onClick={() => onSelect(list.id)}
          style={{
            padding: '6px 14px',
            borderRadius: 999,
            border: selectedListId === list.id ? '1px solid var(--color-growth)' : '1px solid var(--color-line)',
            background: selectedListId === list.id ? 'var(--color-growth-soft)' : 'var(--color-surface)',
            color: selectedListId === list.id ? 'var(--color-growth)' : 'var(--color-ink-soft)',
            fontSize: 13,
            fontWeight: selectedListId === list.id ? 600 : 400,
          }}
        >
          {list.name}
        </button>
      ))}

      {creating ? (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') { setCreating(false); setName(''); }
            }}
            placeholder="اسم القائمة…"
            style={{
              fontSize: 13,
              padding: '5px 10px',
              borderRadius: 999,
              border: '1px solid var(--color-line)',
              width: 120,
            }}
          />
          <button
            onClick={handleCreate}
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              border: '1px solid var(--color-growth)',
              background: 'var(--color-growth-soft)',
              color: 'var(--color-growth)',
              fontSize: 14,
            }}
          >
            ✓
          </button>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          title="قائمة جديدة"
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            border: '1px solid var(--color-line)',
            background: 'var(--color-surface)',
            color: 'var(--color-ink-soft)',
            fontSize: 14,
          }}
        >
          +
        </button>
      )}
    </div>
  );
}