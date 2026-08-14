import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { DEFAULT_LIST_ID } from '../db/db';
import { getChildLists, getListPath, createList, deleteList } from '../logic/listLogic';

/**
 * متصفح قوائم متعشّش: يعرض القوائم الفرعية للقائمة الحالية (currentListId)
 * مع شريط تنقّل (breadcrumb) للمسار الكامل من الجذر. currentListId = null
 * يعني "المستوى الجذري لكل القوائم" (وليس القائمة الافتراضية "عام").
 */
export default function ListBrowser({ currentListId, onNavigate }) {
  const [newListName, setNewListName] = useState('');
  const [creating, setCreating] = useState(false);

  const childLists = useLiveQuery(() => getChildLists(currentListId), [currentListId]) || [];
  const path = useLiveQuery(() => getListPath(currentListId), [currentListId]) || [];

  async function handleCreateList() {
    const name = newListName.trim();
    if (!name) return;
    await createList({ name, parentListId: currentListId });
    setNewListName('');
    setCreating(false);
  }

  async function handleDeleteList(e, listId) {
    e.stopPropagation();
    if (!window.confirm('حذف هذه القائمة سيحذف كل ما بداخلها من قوائم فرعية ومهام. متابعة؟')) return;
    try {
      await deleteList(listId);
    } catch (err) {
      window.alert(err.message);
    }
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexWrap: 'wrap',
          fontSize: 13,
          marginBottom: 12,
        }}
      >
        <button
          onClick={() => onNavigate(null)}
          style={{
            border: 'none',
            background: 'none',
            color: currentListId === null ? 'var(--color-growth)' : 'var(--color-ink-soft)',
            fontWeight: currentListId === null ? 600 : 400,
            fontSize: 13,
            padding: '2px 4px',
          }}
        >
          كل القوائم
        </button>
        {path.map((list) => (
          <span key={list.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--color-ink-soft)' }}>◁</span>
            <button
              onClick={() => onNavigate(list.id)}
              style={{
                border: 'none',
                background: 'none',
                color: list.id === currentListId ? 'var(--color-growth)' : 'var(--color-ink-soft)',
                fontWeight: list.id === currentListId ? 600 : 400,
                fontSize: 13,
                padding: '2px 4px',
              }}
            >
              {list.name}
            </button>
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {childLists.map((list) => (
          <div
            key={list.id}
            onClick={() => onNavigate(list.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-line)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 16 }}>📁</span>
            <span style={{ flex: 1, fontSize: 14 }}>{list.name}</span>
            {list.id !== DEFAULT_LIST_ID && (
              <button
                onClick={(e) => handleDeleteList(e, list.id)}
                title="حذف القائمة"
                style={{ border: 'none', background: 'none', color: 'var(--color-ink-soft)', fontSize: 13 }}
              >
                🗑
              </button>
            )}
          </div>
        ))}
      </div>

      {creating ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input
            autoFocus
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateList()}
            placeholder="اسم القائمة الجديدة…"
            style={{
              flex: 1,
              padding: '8px 10px',
              border: '1px solid var(--color-line)',
              borderRadius: 'var(--radius-sm)',
            }}
          />
          <button
            onClick={handleCreateList}
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-growth)',
              background: 'var(--color-growth-soft)',
              color: 'var(--color-growth)',
              fontSize: 13,
            }}
          >
            إضافة
          </button>
          <button
            onClick={() => {
              setCreating(false);
              setNewListName('');
            }}
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-line)',
              background: 'transparent',
              color: 'var(--color-ink-soft)',
              fontSize: 13,
            }}
          >
            إلغاء
          </button>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          style={{
            marginTop: 10,
            border: '1px dashed var(--color-line)',
            background: 'transparent',
            color: 'var(--color-ink-soft)',
            fontSize: 13,
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            width: '100%',
          }}
        >
          + قائمة فرعية جديدة {currentListId === null ? '(في الجذر)' : ''}
        </button>
      )}
    </div>
  );
}
