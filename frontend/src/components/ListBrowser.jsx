import { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { DEFAULT_LIST_ID } from '../db/db';
import { getChildLists, createList, deleteList, moveList } from '../logic/listLogic';

/**
 * نموذج صغير لإنشاء قائمة جديدة: مربع إدخال، وأسفله زرا "إضافة" و"إلغاء"
 * (وليس بجانبه) - يُستخدم عند إضافة قائمة جذرية أو قائمة فرعية على حد سواء.
 */
function NewListForm({ placeholder, onSubmit, onCancel }) {
  const [name, setName] = useState('');

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setName('');
  }

  return (
    <div style={{ marginTop: 8, marginBottom: 8 }}>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '8px 10px',
          border: '1px solid var(--color-line)',
          borderRadius: 'var(--radius-sm)',
        }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button
          onClick={submit}
          style={{
            flex: 1,
            padding: '8px 14px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-growth)',
            background: 'var(--color-growth)',
            color: '#fff',
            fontSize: 13,
          }}
        >
          إضافة
        </button>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
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
    </div>
  );
}

/**
 * عقدة قائمة واحدة قابلة للتكرار (تماماً بنفس منطق TaskTree.jsx): تعرض
 * القائمة الحالية مع سهم طي/فتح لعرض فروعها، وتتكرر لعرض كل الفروع المتعشّشة.
 * الضغط على اسم القائمة يحدّدها لعرض مهامها (لا علاقة له بالطي/الفتح).
 */
function ListNode({ list, depth, currentListId, onNavigate, dragState }) {
  const [collapsed, setCollapsed] = useState(true);
  const [addingChild, setAddingChild] = useState(false);

  const children = useLiveQuery(() => getChildLists(list.id), [list.id]) || [];
  const hasChildren = children.length > 0;
  const isSelected = currentListId === list.id;

  const { dragId, dropHint, startDrag, registerNodeRef, justDraggedRef, registerNodeName } = dragState;
  const isDragging = dragId === list.id;
  const isDropNest = dropHint?.kind === 'nest' && dropHint.parentListId === list.id;
  const isDropBefore = dropHint?.kind === 'reorder' && dropHint.targetId === list.id && dropHint.position === 'before';
  const isDropAfter = dropHint?.kind === 'reorder' && dropHint.targetId === list.id && dropHint.position === 'after';

  // نحدّث خريطة الأسماء الحية في كل رسم حتى تعكس البطاقة العائمة أثناء
  // السحب اسم القائمة الصحيح دائماً، دون قراءته من نص عنصر DOM (الذي
  // يحتوي أيضاً على الأيقونات وأزرار +/🗑 فيختلط النص).
  registerNodeName(list.id, list.name);

  async function handleAddChild(name) {
    await createList({ name, parentListId: list.id });
    setAddingChild(false);
    setCollapsed(false); // نظهر القائمة الفرعية الجديدة مباشرة
  }

  async function handleDelete(e) {
    e.stopPropagation();
    if (!window.confirm('حذف هذه القائمة سيحذف كل ما بداخلها من قوائم فرعية ومهام. متابعة؟')) return;
    try {
      await deleteList(list.id);
    } catch (err) {
      window.alert(err.message);
    }
  }

  function handleClick() {
    if (justDraggedRef.current) return;
    onNavigate(list.id);
  }

  return (
    <div style={{ marginInlineStart: depth > 0 ? 20 : 0 }}>
      {isDropBefore && (
        <div style={{ height: 3, background: 'var(--color-growth)', borderRadius: 2, margin: '2px 0' }} />
      )}

      <div
        ref={(el) => registerNodeRef(list.id, el, list.parent_list_id ?? null)}
        onClick={handleClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 10px',
          marginBottom: 6,
          background: isSelected ? 'var(--color-growth-soft)' : 'var(--color-surface)',
          border: isDropNest ? '2px solid var(--color-growth)' : '1px solid var(--color-line)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          opacity: isDragging ? 0.4 : 1,
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setCollapsed((c) => !c);
          }}
          aria-label={collapsed ? 'فتح الفروع' : 'طي الفروع'}
          style={{
            width: 18,
            height: 18,
            border: 'none',
            background: 'none',
            color: 'var(--color-ink-soft)',
            visibility: hasChildren ? 'visible' : 'hidden',
            fontSize: 11,
            padding: 0,
            flexShrink: 0,
          }}
        >
          {collapsed ? '◀' : '▾'}
        </button>

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
            flexShrink: 0,
          }}
        >
          ⠿
        </span>

        <span style={{ fontSize: 16, flexShrink: 0 }}>📁</span>

        <span
          style={{
            flex: 1,
            fontSize: 14,
            color: isSelected ? 'var(--color-growth)' : 'var(--color-ink)',
            fontWeight: isSelected ? 600 : 400,
          }}
        >
          {list.name}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setAddingChild((v) => !v);
          }}
          title="أضف قائمة فرعية هنا"
          style={{
            width: 22,
            height: 22,
            border: '1px solid var(--color-line)',
            background: 'var(--color-surface)',
            borderRadius: 6,
            fontSize: 13,
            color: 'var(--color-ink-soft)',
            flexShrink: 0,
          }}
        >
          +
        </button>

        {list.id !== DEFAULT_LIST_ID && (
          <button
            onClick={handleDelete}
            title="حذف القائمة"
            style={{ border: 'none', background: 'none', color: 'var(--color-ink-soft)', fontSize: 13, flexShrink: 0 }}
          >
            🗑
          </button>
        )}
      </div>

      {addingChild && (
        <div style={{ marginInlineStart: 20 }}>
          <NewListForm
            placeholder="اسم القائمة الفرعية…"
            onSubmit={handleAddChild}
            onCancel={() => setAddingChild(false)}
          />
        </div>
      )}

      {isDropAfter && (
        <div style={{ height: 3, background: 'var(--color-growth)', borderRadius: 2, margin: '2px 0' }} />
      )}

      {!collapsed &&
        children.map((child) => (
          <ListNode
            key={child.id}
            list={child}
            depth={depth + 1}
            currentListId={currentListId}
            onNavigate={onNavigate}
            dragState={dragState}
          />
        ))}
    </div>
  );
}

/**
 * متصفح القوائم كشجرة قابلة للطي/الفتح (بنفس فلسفة TaskTree.jsx)، مع دعم
 * السحب والإفلات (Hold & Drag) عبر كل مستويات الشجرة دفعة واحدة للنقل
 * وإعادة الترتيب. الضغط على اسم قائمة يحدّدها (currentListId) لعرض مهامها.
 */
export default function ListBrowser({ currentListId, onNavigate }) {
  const [rootCreating, setRootCreating] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [dragPos, setDragPos] = useState(null); // {x, y}
  const [dropHint, setDropHint] = useState(null); // {kind, parentListId, targetId?, position?}

  const nodeRefs = useRef({}); // listId -> { el, parentListId }
  const nodeNames = useRef({}); // listId -> name (لعرض اسم نظيف في البطاقة العائمة أثناء السحب)
  const rootDropZoneRef = useRef(null);
  const dropHintRef = useRef(null);
  const justDraggedRef = useRef(false);

  const rootLists = useLiveQuery(() => getChildLists(null), []) || [];

  function registerNodeRef(id, el, parentListId) {
    if (el) {
      nodeRefs.current[id] = { el, parentListId };
    } else {
      delete nodeRefs.current[id];
    }
  }

  function registerNodeName(id, name) {
    nodeNames.current[id] = name;
  }

  function detectHoverTarget(x, y) {
    // أولاً: هل المؤشر فوق منطقة "الإفلات للمستوى الجذري"؟
    const rootEl = rootDropZoneRef.current;
    if (rootEl) {
      const rect = rootEl.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return { kind: 'nest', parentListId: null };
      }
    }

    // ثانياً: هل المؤشر فوق إحدى بطاقات القوائم (بأي عمق في الشجرة)؟
    for (const [id, entry] of Object.entries(nodeRefs.current)) {
      if (id === dragId) continue;
      const { el, parentListId } = entry;
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        const relativeY = (y - rect.top) / rect.height;

        if (relativeY >= 0.3 && relativeY <= 0.7) {
          // منتصف البطاقة = تعشيش بالداخل (تصبح ابنة لهذه القائمة)
          return { kind: 'nest', parentListId: id };
        }
        if (relativeY < 0.3) {
          // الحافة العلوية = ترتيبها قبل هذه القائمة مباشرة (أخت لها)
          return { kind: 'reorder', parentListId, targetId: id, position: 'before' };
        }
        // الحافة السفلية = ترتيبها بعد هذه القائمة مباشرة (أخت لها)
        return { kind: 'reorder', parentListId, targetId: id, position: 'after' };
      }
    }

    return null;
  }

  /**
   * يحوّل تلميح الإفلات (الذي يُحسب أثناء السحب فوراً) إلى وجهة نهائية دقيقة
   * (parentListId + beforeId) لحظة الإفلات فعلياً - نستعلم عن الإخوة الفعليين
   * بشكل حي هنا (لا بأس بالـ async هنا لأنه يُنفَّذ مرة واحدة فقط عند الإفلات).
   */
  async function resolveDropHint(hint) {
    if (!hint) return null;
    if (hint.kind === 'nest') {
      return { parentListId: hint.parentListId, beforeId: null };
    }
    const siblings = await getChildLists(hint.parentListId);
    if (hint.position === 'before') {
      return { parentListId: hint.parentListId, beforeId: hint.targetId };
    }
    const idx = siblings.findIndex((l) => l.id === hint.targetId);
    const next = siblings[idx + 1];
    const beforeId = next && next.id !== dragId ? next.id : null;
    return { parentListId: hint.parentListId, beforeId };
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
      const hint = detectHoverTarget(e.clientX, e.clientY);
      dropHintRef.current = hint;
      setDropHint(hint);
    }

    async function onUp() {
      const hint = dropHintRef.current;
      const movedId = dragId;

      justDraggedRef.current = true;
      setTimeout(() => {
        justDraggedRef.current = false;
      }, 0);

      setDragId(null);
      setDragPos(null);
      setDropHint(null);
      dropHintRef.current = null;

      if (hint && movedId) {
        try {
          const destination = await resolveDropHint(hint);
          await moveList(movedId, destination);
        } catch (err) {
          window.alert(err.message);
        }
      }
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

  async function handleAddRootList(name) {
    await createList({ name, parentListId: null });
    setRootCreating(false);
  }

  const dragState = { dragId, dropHint, startDrag, registerNodeRef, justDraggedRef, registerNodeName };
  const draggedListLabel = dragId ? nodeNames.current[dragId] : null;

  return (
    <div style={{ marginBottom: 20 }}>
      {rootLists.map((list) => (
        <ListNode
          key={list.id}
          list={list}
          depth={0}
          currentListId={currentListId}
          onNavigate={onNavigate}
          dragState={dragState}
        />
      ))}

      {dragId && (
        <div
          ref={rootDropZoneRef}
          style={{
            marginTop: 4,
            marginBottom: 10,
            border: dropHint?.kind === 'nest' && dropHint.parentListId === null
              ? '2px dashed var(--color-growth)'
              : '1px dashed var(--color-line)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--color-ink-soft)',
          }}
        >
          أفلت هنا لنقلها إلى المستوى الجذري (الأعلى)
        </div>
      )}

      {rootCreating ? (
        <NewListForm
          placeholder="اسم القائمة الجديدة…"
          onSubmit={handleAddRootList}
          onCancel={() => setRootCreating(false)}
        />
      ) : (
        <button
          onClick={() => setRootCreating(true)}
          style={{
            marginTop: 6,
            border: '1px dashed var(--color-line)',
            background: 'transparent',
            color: 'var(--color-ink-soft)',
            fontSize: 13,
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            width: '100%',
          }}
        >
          + قائمة جذرية جديدة
        </button>
      )}

      {dragId && dragPos && (
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
          📁 {draggedListLabel}
        </div>
      )}
    </div>
  );
}
