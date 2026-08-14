import { useEffect, useState } from 'react';
import ProgressRing from './ProgressRing';
import QuickAdd from './QuickAdd';
import {
  completeTask,
  uncompleteTask,
  abandonTask,
  deleteTask,
  createTask,
  calculateProgress,
  linkToDailyList,
  unlinkFromDailyList,
  isMissed,
} from '../logic/taskLogic';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function useProgress(taskId, allTasks) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    calculateProgress(taskId).then(setProgress);
  }, [taskId, allTasks]);

  return progress;
}

function Badge({ tone, children }) {
  const map = {
    brick: {
      bg: 'var(--color-brick-soft)',
      fg: 'var(--color-brick)',
    },
    amber: {
      bg: 'var(--color-amber-soft)',
      fg: 'var(--color-amber)',
    },
  };

  const c = map[tone];

  return (
    <span
      style={{
        fontSize: 11,
        padding: '2px 7px',
        borderRadius: 999,
        background: c.bg,
        color: c.fg,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
}

function IconButton({ children, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{
        width: 26,
        height: 26,
        borderRadius: 6,
        border: '1px solid var(--color-line)',
        background: 'var(--color-surface)',
        fontSize: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-ink-soft)',
        flexShrink: 0,
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}

/**
 * عقدة شجرة قابلة للتكرار: تعرض مهمة واحدة وكل أبنائها المتعشّشة.
 * originLabel: يُستخدم فقط لعرض "(من: ...)" في شاشة اليوم للمهام الفرعية.
 */
export default function TaskTree({
  task,
  allTasks,
  depth = 0,
  originLabel,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const rawChildren = allTasks.filter((t) => t.parent_id === task.id);
  const activeChildren = rawChildren.filter(
    (t) => t.status !== 'completed'
  );
  const completedChildren = rawChildren.filter(
    (t) => t.status === 'completed'
  );

  const hasChildren = rawChildren.length > 0;
  const progress = useProgress(task.id, allTasks);
  const missed = task.status !== 'abandoned' && isMissed(task);
  const isProjectHeading = depth === 0 && task.type === 'composite';

  async function handleAddChild({ title, type }) {
    await createTask({
      title,
      type,
      parentId: task.id,
      dueDate: todayStr(),
    });

    setAddingChild(false);
  }

  return (
    <div
      style={{
        marginInlineStart: depth > 0 ? 'clamp(8px, 4vw, 20px)' : 0,
        minWidth: 0,
        maxWidth: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 4px',
          borderBottom:
            depth === 0
              ? '1px solid var(--color-line)'
              : 'none',
          minWidth: 0,
          width: '100%',
          boxSizing: 'border-box',
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={
            collapsed ? 'فتح الفروع' : 'طي الفروع'
          }
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

        {task.type === 'single' ? (
          <input
            type="checkbox"
            checked={task.status === 'completed'}
            onChange={(e) =>
              e.target.checked
                ? completeTask(task.id)
                : uncompleteTask(task.id)
            }
            style={{
              accentColor: 'var(--color-growth)',
              width: 16,
              height: 16,
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ProgressRing
              percent={progress}
              size={isProjectHeading ? 32 : 26}
            />
          </div>
        )}

        <span
          style={{
            flex: '1 1 120px',
            minWidth: 0,
            maxWidth: '100%',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
            fontFamily: isProjectHeading
              ? 'var(--font-display)'
              : 'var(--font-body)',
            fontSize: isProjectHeading
              ? 'clamp(16px, 4vw, 19px)'
              : 'clamp(14px, 3.5vw, 15px)',
            fontWeight:
              task.type === 'composite' ? 600 : 400,
            textDecoration:
              task.status === 'completed'
                ? 'line-through'
                : 'none',
            color:
              task.status === 'completed'
                ? 'var(--color-ink-soft)'
                : 'var(--color-ink)',
            lineHeight: 1.45,
          }}
        >
          {task.title}
        </span>

        {originLabel && (
          <span
            style={{
              fontSize: 12,
              color: 'var(--color-ink-soft)',
              minWidth: 0,
              maxWidth: '100%',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
              flexShrink: 1,
            }}
          >
            من: {originLabel}
          </span>
        )}

        {task.status === 'abandoned' && (
          <Badge tone="brick">متروكة</Badge>
        )}

        {missed && (
          <Badge
            tone={
              task.status === 'completed'
                ? 'amber'
                : 'brick'
            }
          >
            {task.status === 'completed'
              ? 'أُنجزت متأخرة'
              : 'ضائعة'}
          </Badge>
        )}

        <div
          style={{
            display: 'flex',
            gap: 4,
            flexShrink: 0,
            flexWrap: 'wrap',
            marginInlineStart: 'auto',
          }}
        >
          {task.type === 'composite' && (
            <IconButton
              onClick={() =>
                setAddingChild((v) => !v)
              }
              title="أضف مهمة فرعية"
            >
              +
            </IconButton>
          )}

          <IconButton
            onClick={() =>
              task.is_in_daily_list
                ? unlinkFromDailyList(task.id)
                : linkToDailyList(task.id, todayStr())
            }
            title={
              task.is_in_daily_list
                ? 'فك الربط باليوميات'
                : 'ربط باليوميات'
            }
          >
            {task.is_in_daily_list ? '☀' : '☆'}
          </IconButton>

          <IconButton
            onClick={() => abandonTask(task.id)}
            title="تخلٍّ عن المهمة"
          >
            ✕
          </IconButton>

          <IconButton
            onClick={() => deleteTask(task.id)}
            title="حذف"
          >
            🗑
          </IconButton>
        </div>
      </div>

      {addingChild && (
        <div
          style={{
            marginInlineStart: 'clamp(8px, 4vw, 20px)',
            minWidth: 0,
            maxWidth: '100%',
          }}
        >
          <QuickAdd
            allowType
            placeholder="اسم المهمة الفرعية…"
            onAdd={handleAddChild}
          />
        </div>
      )}

      {!collapsed && (
        <>
          {activeChildren.map((child) => (
            <TaskTree
              key={child.id}
              task={child}
              allTasks={allTasks}
              depth={depth + 1}
            />
          ))}

          {completedChildren.length > 0 && (
            <div
              style={{
                marginInlineStart:
                  'clamp(8px, 4vw, 20px)',
                minWidth: 0,
                maxWidth: '100%',
              }}
            >
              <button
                onClick={() =>
                  setShowCompleted((v) => !v)
                }
                style={{
                  border: 'none',
                  background: 'none',
                  color: 'var(--color-ink-soft)',
                  fontSize: 12,
                  padding: '4px 4px',
                  maxWidth: '100%',
                  overflowWrap: 'anywhere',
                }}
              >
                {showCompleted ? '▾' : '◀'} المهام
                المنجزة ({completedChildren.length})
              </button>

              {showCompleted &&
                completedChildren.map((child) => (
                  <TaskTree
                    key={child.id}
                    task={child}
                    allTasks={allTasks}
                    depth={depth + 1}
                  />
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}