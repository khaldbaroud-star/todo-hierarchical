import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_LIST_ID } from '../db/db';
import TaskTree from '../components/TaskTree';
import QuickAdd from '../components/QuickAdd';
import ListSwitcher from '../components/ListSwitcher';
import { createTask, createList } from '../logic/taskLogic';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function ProjectsPage() {
  const rawTasks =
    useLiveQuery(() => db.tasks.toArray(), []) || [];

  const rawLists =
    useLiveQuery(() => db.lists.toArray(), []) || [];

  const lists = rawLists
    .filter((l) => !l.deleted)
    .sort((a, b) => a.order_index - b.order_index);

  const [selectedListId, setSelectedListId] =
    useState(DEFAULT_LIST_ID);

  const allTasks = rawTasks.filter((t) => !t.deleted);

  const rootTasksAll = allTasks
    .filter((t) => !t.parent_id)
    .filter(
      (t) =>
        (t.list_id || DEFAULT_LIST_ID) ===
        selectedListId
    );

  const rootTasks = rootTasksAll.filter(
    (t) => t.status !== 'completed'
  );

  const completedRootTasks = rootTasksAll.filter(
    (t) => t.status === 'completed'
  );

  const [showCompleted, setShowCompleted] =
    useState(false);

  async function handleAdd({ title, type }) {
    await createTask({
      title,
      type,
      parentId: null,
      dueDate: todayStr(),
      addToDaily: false,
      listId: selectedListId,
    });
  }

  async function handleCreateList(name) {
    const list = await createList(name);
    setSelectedListId(list.id);
  }

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 640,
        margin: '0 auto',
        padding:
          'clamp(20px, 5vw, 32px) clamp(12px, 4vw, 20px) 60px',
        boxSizing: 'border-box',
        overflowX: 'hidden',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(28px, 8vw, 36px)',
          margin: 0,
          lineHeight: 1.2,
        }}
      >
        المشاريع
      </h1>

      <p
        style={{
          color: 'var(--color-ink-soft)',
          marginTop: 4,
          marginBottom: 28,
          fontSize: 'clamp(13px, 3.5vw, 15px)',
          lineHeight: 1.6,
        }}
      >
        كل مهامك، فردية ومركبة، بأي عمق تعشيش
      </p>

      <div
        style={{
          width: '100%',
          minWidth: 0,
          maxWidth: '100%',
        }}
      >
        <ListSwitcher
          lists={lists}
          selectedListId={selectedListId}
          onSelect={setSelectedListId}
          onCreate={handleCreateList}
        />
      </div>

      <div
        style={{
          width: '100%',
          minWidth: 0,
          maxWidth: '100%',
        }}
      >
        <QuickAdd
          allowType
          onAdd={handleAdd}
          placeholder="اكتب اسم مهمة أو مشروع جديد…"
        />
      </div>

      <div
        style={{
          marginTop: 6,
          width: '100%',
          minWidth: 0,
          maxWidth: '100%',
        }}
      >
        {rootTasks.length === 0 && (
          <p
            style={{
              color: 'var(--color-ink-soft)',
              padding: '28px 4px',
              margin: 0,
              maxWidth: '100%',
              overflowWrap: 'anywhere',
              lineHeight: 1.6,
            }}
          >
            لا توجد مهام بعد.
          </p>
        )}

        {rootTasks.map((t) => (
          <TaskTree
            key={t.id}
            task={t}
            allTasks={allTasks}
          />
        ))}
      </div>

      {completedRootTasks.length > 0 && (
        <div
          style={{
            marginTop: 20,
            width: '100%',
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
              fontSize: 13,
              padding: '4px 4px',
              maxWidth: '100%',
              overflowWrap: 'anywhere',
            }}
          >
            {showCompleted ? '▾' : '◀'} المهام المنجزة (
            {completedRootTasks.length})
          </button>

          {showCompleted && (
            <div
              style={{
                marginTop: 8,
                width: '100%',
                minWidth: 0,
                maxWidth: '100%',
              }}
            >
              {completedRootTasks.map((t) => (
                <TaskTree
                  key={t.id}
                  task={t}
                  allTasks={allTasks}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}