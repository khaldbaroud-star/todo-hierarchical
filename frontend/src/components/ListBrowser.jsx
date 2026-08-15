import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { DEFAULT_LIST_ID } from '../db/db';
import {
  getChildLists,
  getListPath,
  createList,
  deleteList,
} from '../logic/listLogic';

/**
 * متصفح قوائم متعشّش: يعرض القوائم الفرعية للقائمة الحالية (currentListId)
 * مع شريط تنقّل (breadcrumb) للمسار الكامل من الجذر.
 * currentListId = null يعني "المستوى الجذري لكل القوائم".
 */
export default function ListBrowser({ currentListId, onNavigate }) {
  const [newListName, setNewListName] = useState('');
  const [creating, setCreating] = useState(false);

  const childLists =
    useLiveQuery(() => getChildLists(currentListId), [currentListId]) || [];

  const path =
    useLiveQuery(() => getListPath(currentListId), [currentListId]) || [];

  async function handleCreateList() {
    const name = newListName.trim();

    if (!name) return;

    await createList({
      name,
      parentListId: currentListId,
    });

    setNewListName('');
    setCreating(false);
  }

  async function handleDeleteList(e, listId) {
    e.stopPropagation();

    if (
      !window.confirm(
        'حذف هذه القائمة سيحذف كل ما بداخلها من قوائم فرعية ومهام. متابعة؟'
      )
    ) {
      return;
    }

    try {
      await deleteList(listId);
    } catch (err) {
      window.alert(err.message);
    }
  }

  return (
    <div
      style={{
        marginBottom: 20,
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
      }}
    >
      {/* Breadcrumb */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexWrap: 'wrap',
          fontSize: 13,
          marginBottom: 12,
          minWidth: 0,
        }}
      >
        <button
          onClick={() => onNavigate(null)}
          style={{
            border: 'none',
            background: 'none',
            color:
              currentListId === null
                ? 'var(--color-growth)'
                : 'var(--color-ink-soft)',
            fontWeight: currentListId === null ? 600 : 400,
            fontSize: 'clamp(11px, 3vw, 13px)',
            padding: '2px 4px',
            minWidth: 0,
            maxWidth: '100%',
          }}
        >
          كل القوائم
        </button>

        {path.map((list) => (
          <span
            key={list.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              minWidth: 0,
              maxWidth: '100%',
            }}
          >
            <span style={{ color: 'var(--color-ink-soft)' }}>◁</span>

            <button
              onClick={() => onNavigate(list.id)}
              style={{
                border: 'none',
                background: 'none',
                color:
                  list.id === currentListId
                    ? 'var(--color-growth)'
                    : 'var(--color-ink-soft)',
                fontWeight: list.id === currentListId ? 600 : 400,
                fontSize: 'clamp(11px, 3vw, 13px)',
                padding: '2px 4px',
                minWidth: 0,
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {list.name}
            </button>
          </span>
        ))}
      </div>

      {/* القوائم الفرعية */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          width: '100%',
          minWidth: 0,
        }}
      >
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
              width: '100%',
              minWidth: 0,
              maxWidth: '100%',
              boxSizing: 'border-box',
            }}
          >
            <span
              style={{
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              📁
            </span>

            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 'clamp(13px, 3.5vw, 14px)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {list.name}
            </span>

            {list.id !== DEFAULT_LIST_ID && (
              <button
                onClick={(e) => handleDeleteList(e, list.id)}
                title="حذف القائمة"
                style={{
                  border: 'none',
                  background: 'none',
                  color: 'var(--color-ink-soft)',
                  fontSize: 13,
                  flexShrink: 0,
                  padding: 4,
                }}
              >
                🗑
              </button>
            )}
          </div>
        ))}
      </div>

      {/* إنشاء قائمة جديدة */}
      {creating ? (
        <div
          style={{
            marginTop: 10,
            width: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
          }}
        >
          {/* حقل الاسم في صف مستقل */}
          <input
            autoFocus
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreateList();
              }

              if (e.key === 'Escape') {
                setCreating(false);
                setNewListName('');
              }
            }}
            placeholder="اسم القائمة الجديدة…"
            style={{
              display: 'block',
              width: '100%',
              minWidth: 0,
              boxSizing: 'border-box',

              padding: '9px 10px',
              border: '1px solid var(--color-line)',
              borderRadius: 'var(--radius-sm)',

              fontSize: 'clamp(13px, 3.5vw, 15px)',
              color: 'var(--color-ink)',
              background: 'var(--color-surface)',

              outline: 'none',
            }}
          />

          {/* الأزرار في صف مستقل */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-start',
              alignItems: 'center',
              gap: 8,
              marginTop: 8,
              flexWrap: 'wrap',
              width: '100%',
            }}
          >
            <button
              onClick={handleCreateList}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-growth)',
                background: 'var(--color-growth-soft)',
                color: 'var(--color-growth)',
                fontSize: 'clamp(12px, 3vw, 13px)',
                whiteSpace: 'nowrap',
                flexShrink: 0,
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
                fontSize: 'clamp(12px, 3vw, 13px)',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              إلغاء
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          style={{
            marginTop: 10,
            border: '1px dashed var(--color-line)',
            background: 'transparent',
            color: 'var(--color-ink-soft)',
            fontSize: 'clamp(12px, 3vw, 13px)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            width: '100%',
            boxSizing: 'border-box',
            minWidth: 0,
          }}
        >
          + قائمة فرعية جديدة{' '}
          {currentListId === null ? '(في الجذر)' : ''}
        </button>
      )}
    </div>
  );
}