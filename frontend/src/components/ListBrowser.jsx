import { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { DEFAULT_LIST_ID } from '../db/db';
import { getChildLists, getListPath, createList, deleteList, moveList } from '../logic/listLogic';

/**
 * متصفح قوائم متعشّش مع دعم السحب والإفلات (Hold & Drag) لإعادة الترتيب
 * ونقل القوائم بين المستويات المختلفة.
 *
 * منطق الإفلات (يُحسب في computeDropHint حسب موضع المؤشر لحظة السحب):
 * - فوق عنصر في شريط المسار (breadcrumb) أو "كل القوائم" -> نقل لذلك المستوى.
 * - فوق منتصف بطاقة قائمة أخرى -> تعشيش بداخلها (تصبح ابنة لها).
 * - فوق الحافة العلوية/السفلية لبطاقة -> إعادة ترتيب كأخت قبلها/بعدها.
 *
 * currentListId = null يعني "المستوى الجذري لكل القوائم" (وليس القائمة
 * الافتراضية "عام").
 */
export default function ListBrowser({ currentListId, onNavigate }) {
  const [newListName, setNewListName] = useState('');
  const [creatingMode, setCreatingMode] = useState(null); // null | 'child' | 'sibling'
  const [dragId, setDragId] = useState(null);
  const [dragPos, setDragPos] = useState(null); // {x, y}
  const [dropHint, setDropHint] = useState(null); // {parentListId, beforeId, kind}

  const cardRefs = useRef({}); // listId -> عنصر DOM لبطاقة القائمة
  const crumbRefs = useRef({}); // 'root' أو listId -> عنصر DOM لعنصر شريط المسار
  const dropHintRef = useRef(null); // نسخة متزامنة من dropHint لاستخدامها عند الإفلات
  const justDraggedRef = useRef(false); // يمنع تفعيل onClick (تنقّل) مباشرة بعد سحب

  const childLists = useLiveQuery(() => getChildLists(currentListId), [currentListId]) || [];
  const path = useLiveQuery(() => getListPath(currentListId), [currentListId]) || [];

  const parentOfCurrent = path.length >= 2 ? path[path.length - 2].id : null;

  function computeDropHint(x, y) {
    // أولاً: هل المؤشر فوق عنصر في شريط المسار؟ (نقل لمستوى أعلى أو للجذر)
    for (const [key, el] of Object.entries(crumbRefs.current)) {
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        const parentListId = key === 'root' ? null : key;
        if (parentListId === dragId) continue; // لا يمكن أن تصبح القائمة أباً لنفسها
        return { parentListId, beforeId: null, kind: 'crumb' };
      }
    }

    // ثانياً: هل المؤشر فوق إحدى بطاقات القوائم بالمستوى الحالي؟
    for (const [id, el] of Object.entries(cardRefs.current)) {
      if (!el || id === dragId) continue;
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        const relativeY = (y - rect.top) / rect.height;

        if (relativeY >= 0.3 && relativeY <= 0.7) {
          // منتصف البطاقة = تعشيش بالداخل (تصبح القائمة المسحوبة ابنة لهذه)
          return { parentListId: id, beforeId: null, kind: 'nest' };
        }

        if (relativeY < 0.3) {
          // الحافة العلوية = ترتيبها قبل هذه البطاقة مباشرة (نفس المستوى)
          return { parentListId: currentListId, beforeId: id, kind: 'reorder' };
        }

        // الحافة السفلية = ترتيبها بعد هذه البطاقة مباشرة (نفس المستوى)
        const idx = childLists.findIndex((l) => l.id === id);
        const nextSibling = childLists[idx + 1];
        const beforeId = nextSibling && nextSibling.id !== dragId ? nextSibling.id : null;
        return { parentListId: currentListId, beforeId, kind: 'reorder' };
      }
    }

    return null;
  }

  function startDrag(e, listId) {
    e.preventDefault();
    e.stopPropagation();
    setDragId(listId);
    setDragPos({ x: e.clientX, y: e.clientY });
  }

  useEffect(() => {
    if (!dragId) return undefined;

    function onMove(e) {
      e.preventDefault();
      setDragPos({ x: e.clientX, y: e.clientY });
      const hint = computeDropHint(e.clientX, e.clientY);
      dropHintRef.current = hint;
      setDropHint(hint);
    }

    function onUp() {
      const hint = dropHintRef.current;
      if (hint) {
        moveList(dragId, { parentListId: hint.parentListId, beforeId: hint.beforeId }).catch(
          (err) => window.alert(err.message)
        );
      }
      justDraggedRef.current = true;
      setTimeout(() => {
        justDraggedRef.current = false;
      }, 0);

      setDragId(null);
      setDragPos(null);
      setDropHint(null);
      dropHintRef.current = null;
    }

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragId]);

  async function handleCreateList() {
    const name = newListName.trim();
    if (!name) return;

    if (creatingMode === 'sibling') {
      await createList({ name, parentListId: parentOfCurrent });
      setNewListName('');
      setCreatingMode(null);
      onNavigate(parentOfCurrent);
    } else {
      await createList({ name, parentListId: currentListId });
      setNewListName('');
      setCreatingMode(null);
    }
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

  function handleCardClick(listId) {
    if (justDraggedRef.current) return;
    onNavigate(listId);
  }

  const draggedList = dragId ? childLists.find((l) => l.id === dragId) : null;

  return (
    <div style={{ marginBottom: 20 }}>
      {/* شريط المسار (Breadcrumb) - أيضاً منطقة إفلات للنقل لمستوى أعلى */}
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
          ref={(el) => {
            if (el) crumbRefs.current.root = el;
            else delete crumbRefs.current.root;
          }}
          onClick={() => onNavigate(null)}
          style={{
            border: 'none',
            background: 'none',
            color: currentListId === null ? 'var(--color-growth)' : 'var(--color-ink-soft)',
            fontWeight: currentListId === null ? 600 : 400,
            fontSize: 13,
            padding: '3px 6px',
            borderRadius: 6,
            outline:
              dropHint && dropHint.kind === 'crumb' && dropHint.parentListId === null
                ? '2px solid var(--color-growth)'
                : 'none',
          }}
        >
          كل القوائم
        </button>
        {path.map((list) => (
          <span key={list.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--color-ink-soft)' }}>◁</span>
            <button
              ref={(el) => {
                if (el) crumbRefs.current[list.id] = el;
                else delete crumbRefs.current[list.id];
              }}
              onClick={() => onNavigate(list.id)}
              style={{
                border: 'none',
                background: 'none',
                color: list.id === currentListId ? 'var(--color-growth)' : 'var(--color-ink-soft)',
                fontWeight: list.id === currentListId ? 600 : 400,
                fontSize: 13,
                padding: '3px 6px',
                borderRadius: 6,
                outline:
                  dropHint && dropHint.kind === 'crumb' && dropHint.parentListId === list.id
                    ? '2px solid var(--color-growth)'
                    : 'none',
              }}
            >
              {list.name}
            </button>
          </span>
        ))}
      </div>

      {/* بطاقات القوائم الفرعية بالمستوى الحالي */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {childLists.map((list) => {
          const isDragging = dragId === list.id;
          const isDropNest = dropHint && dropHint.kind === 'nest' && dropHint.parentListId === list.id;
          const isDropBefore = dropHint && dropHint.kind === 'reorder' && dropHint.beforeId === list.id;

          return (
            <div key={list.id}>
              {isDropBefore && (
                <div
                  style={{ height: 3, background: 'var(--color-growth)', borderRadius: 2, margin: '2px 0' }}
                />
              )}
              <div
                ref={(el) => {
                  if (el) cardRefs.current[list.id] = el;
                  else delete cardRefs.current[list.id];
                }}
                onClick={() => handleCardClick(list.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  background: 'var(--color-surface)',
                  border: isDropNest ? '2px solid var(--color-growth)' : '1px solid var(--color-line)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  opacity: isDragging ? 0.4 : 1,
                }}
              >
                <span
                  onPointerDown={(e) => startDrag(e, list.id)}
                  onClick={(e) => e.stopPropagation()}
                  title="اسحب لنقل القائمة"
                  style={{
                    cursor: 'grab',
                    color: 'var(--color-ink-soft)',
                    fontSize: 17,
                    lineHeight: 1,
                    touchAction: 'none',
                    padding: '2px 4px',
                  }}
                >
                  ⠿
                </span>
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
            </div>
          );
        })}

        {/* خط إفلات في نهاية القائمة عندما يكون الهدف هو آخر موضع بنفس المستوى */}
        {dropHint &&
          dropHint.kind === 'reorder' &&
          dropHint.beforeId === null &&
          dropHint.parentListId === currentListId && (
            <div style={{ height: 3, background: 'var(--color-growth)', borderRadius: 2, margin: '2px 0' }} />
          )}
      </div>

      {/* نموذج إنشاء قائمة جديدة */}
      {creatingMode ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input
            autoFocus
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateList()}
            placeholder={
              creatingMode === 'sibling' ? 'اسم القائمة (بجانب الحالية)…' : 'اسم القائمة الجديدة…'
            }
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
              setCreatingMode(null);
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
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button
            onClick={() => setCreatingMode('child')}
            style={{
              flex: 1,
              border: '1px dashed var(--color-line)',
              background: 'transparent',
              color: 'var(--color-ink-soft)',
              fontSize: 13,
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
            }}
          >
            + قائمة فرعية جديدة {currentListId === null ? '(في الجذر)' : ''}
          </button>
          {currentListId !== null && (
            <button
              onClick={() => setCreatingMode('sibling')}
              style={{
                flex: 1,
                border: '1px dashed var(--color-line)',
                background: 'transparent',
                color: 'var(--color-ink-soft)',
                fontSize: 13,
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
              }}
            >
              + قائمة بجانب هذه القائمة
            </button>
          )}
        </div>
      )}

      {/* بطاقة عائمة تتبع المؤشر أثناء السحب */}
      {dragId && dragPos && draggedList && (
        <div
          style={{
            position: 'fixed',
            left: dragPos.x + 14,
            top: dragPos.y + 14,
            padding: '6px 14px',
            background: 'var(--color-growth)',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            pointerEvents: 'none',
            zIndex: 1000,
            boxShadow: 'var(--shadow-card)',
            whiteSpace: 'nowrap',
          }}
        >
          📁 {draggedList.name}
        </div>
      )}
    </div>
  );
}
