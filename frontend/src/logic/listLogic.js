import { db, DEFAULT_LIST_ID } from '../db/db';
import { collectAllDescendantIds } from './taskLogic';

function nowISO() {
  return new Date().toISOString();
}

// نتجنّب عمداً .where('parent_list_id').equals(null) لأن استعلام IndexedDB
// المفهرس على قيمة null غير موثوق دائماً بين المتصفحات - نفس النهج المعتمد
// أصلاً في taskLogic.js لمهام الجذر (فلترة في الذاكرة بدل فهرس).
async function getChildListsRaw(parentListId) {
  const allLists = await db.lists.toArray();
  return allLists.filter(
    (l) => !l.deleted && (l.parent_list_id || null) === (parentListId || null)
  );
}

/** يرجع القوائم الفرعية المباشرة (غير المحذوفة)، مرتّبة. استخدم null للمستوى الجذري. */
export async function getChildLists(parentListId = null) {
  const lists = await getChildListsRaw(parentListId);
  return lists.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** يرجع مسار القائمة (breadcrumb) من الجذر وصولاً للقائمة الحالية. */
export async function getListPath(listId) {
  const path = [];
  let current = listId ? await db.lists.get(listId) : null;
  while (current) {
    path.unshift(current);
    current = current.parent_list_id ? await db.lists.get(current.parent_list_id) : null;
  }
  return path;
}

/** ينشئ قائمة جديدة (جذرية أو متعشّشة تحت قائمة أخرى). */
export async function createList({ name, parentListId = null }) {
  if (!name || !name.trim()) {
    throw new Error('اسم القائمة مطلوب');
  }

  const siblings = await getChildListsRaw(parentListId);
  const now = nowISO();

  const list = {
    id: crypto.randomUUID(),
    name: name.trim(),
    parent_list_id: parentListId,
    order: siblings.length,
    deleted: false,
    created_at: now,
    updated_at: now,
  };

  await db.lists.add(list);
  return list;
}

/** إعادة تسمية قائمة موجودة. */
export async function renameList(listId, newName) {
  if (!newName || !newName.trim()) {
    throw new Error('اسم القائمة مطلوب');
  }
  await db.lists.update(listId, { name: newName.trim(), updated_at: nowISO() });
}

async function collectAllDescendantListIds(listId) {
  const children = await getChildListsRaw(listId);
  let ids = [];
  for (const child of children) {
    ids.push(child.id);
    ids = ids.concat(await collectAllDescendantListIds(child.id));
  }
  return ids;
}

/**
 * حذف قائمة (Soft Delete) مع كل تفرّعاتها: القوائم الفرعية بأي عمق،
 * وكل المهام (وأبنائها المتعشّشين) المنتمية لها أو لأي من قوائمها الفرعية.
 * القائمة الافتراضية "عام" محمية من الحذف لأنها المرجع الأساسي لتوافق
 * البيانات القديمة (المهام التي أُنشئت قبل إضافة ميزة القوائم).
 */
export async function deleteList(listId) {
  if (listId === DEFAULT_LIST_ID) {
    throw new Error('لا يمكن حذف القائمة الافتراضية "عام"');
  }

  const listIdsToDelete = [listId, ...(await collectAllDescendantListIds(listId))];
  const now = nowISO();

  await db.transaction('rw', db.lists, db.tasks, async () => {
    for (const lid of listIdsToDelete) {
      await db.lists.update(lid, { deleted: true, updated_at: now });

      const rootTasks = await db.tasks.where('list_id').equals(lid).toArray();
      for (const rootTask of rootTasks) {
        if (rootTask.deleted) continue;
        const idsToDelete = [rootTask.id, ...(await collectAllDescendantIds(rootTask.id))];
        for (const tid of idsToDelete) {
          await db.tasks.update(tid, { deleted: true, updated_at: now });
        }
      }
    }
  });
}
