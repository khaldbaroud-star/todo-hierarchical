import { db, DEFAULT_LIST_ID } from '../db/db';
// ============================================================
// أدوات مساعدة داخلية
// ============================================================

function nowISO() {
  return new Date().toISOString();
}

function todayStr() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

async function getChildren(parentId) {
  const children = await db.tasks.where('parent_id').equals(parentId).toArray();
  return children.filter((t) => !t.deleted);
}

/**
 * يجمع كل المهام "الورقية" (leaf tasks) تحت مهمة معيّنة، بأي عمق تعشيش.
 * الورقة = مهمة ليس لها أي أبناء في الجدول، بغض النظر عن type الخاص بها.
 * إذا كانت المهمة نفسها ورقة (لا أبناء لها) يرجعها هي نفسها.
 */
async function collectLeaves(taskId) {
  const children = await getChildren(taskId);

  if (children.length === 0) {
    const self = await db.tasks.get(taskId);
    return self ? [self] : [];
  }

  let leaves = [];
  for (const child of children) {
    const childLeaves = await collectLeaves(child.id);
    leaves = leaves.concat(childLeaves);
  }
  return leaves;
}

/**
 * يجمع IDs كل الأحفاد (وليس الأوراق فقط) تحت مهمة معيّنة، بأي عمق تعشيش.
 * يُستخدم لتفعيل "الربط التصاعدي" باليوميات: ربط/فك ربط مركبة يشمل كل فروعها.
 */
async function collectAllDescendantIds(taskId) {
  const children = await getChildren(taskId);
  let ids = [];
  for (const child of children) {
    ids.push(child.id);
    const nested = await collectAllDescendantIds(child.id);
    ids = ids.concat(nested);
  }
  return ids;
}

// ============================================================
// قاعدة 2: دائرة التقدم النسبية (من الأوراق فقط، بوزن متساوٍ)
// ============================================================

/**
 * يرجع نسبة الإنجاز (0-100) لمهمة مركبة، محسوبة من كل أوراقها.
 * كل ورقة لها نفس الوزن بغض النظر عن عمقها في الشجرة.
 */
export async function calculateProgress(taskId) {
  const leaves = await collectLeaves(taskId);
  if (leaves.length === 0) return 0;

  const completedCount = leaves.filter((l) => l.status === 'completed').length;
  return Math.round((completedCount / leaves.length) * 100);
}

// ============================================================
// قاعدة 3 + 4: الاكتمال التصاعدي + الاكتمال التلقائي للمركبة
// ============================================================

/**
 * يُعاد حساب تقدم مهمة معيّنة، ويحوّلها تلقائياً لـ "منجزة" إذا وصلت 100%،
 * ثم يصعد لوالدها المباشر ويكرر نفس الشيء، وهكذا حتى الجذر (recursion صاعد).
 */
async function recalcAndBubbleUp(taskId) {
  const task = await db.tasks.get(taskId);
  if (!task || task.type !== 'composite') return;

  const progress = await calculateProgress(taskId);

  if (progress === 100 && task.status !== 'completed') {
    // كل الأوراق اكتملت -> المركبة تكتمل تلقائياً
    await db.tasks.update(taskId, {
      status: 'completed',
      completed_at: nowISO(),
      updated_at: nowISO(),
    });
  } else if (progress < 100 && task.status === 'completed') {
    // حالة مهمة: تمت إضافة ورقة جديدة غير مكتملة (أو تراجع عن ورقة) بعد
    // أن كانت المركبة قد اكتملت - يجب التراجع عن اكتمالها تلقائياً
    await db.tasks.update(taskId, {
      status: 'pending',
      completed_at: null,
      updated_at: nowISO(),
    });
  } else {
    await db.tasks.update(taskId, { updated_at: nowISO() });
  }

  if (task.parent_id) {
    await recalcAndBubbleUp(task.parent_id);
  }
}

/**
 * إنجاز مهمة (فردية أو فرعية ورقية). يُشغّل الاكتمال التصاعدي لكل الأجداد.
 */
export async function completeTask(taskId) {
  const task = await db.tasks.get(taskId);
  if (!task) throw new Error('المهمة غير موجودة');

  await db.tasks.update(taskId, {
    status: 'completed',
    completed_at: nowISO(),
    updated_at: nowISO(),
  });

  if (task.parent_id) {
    await recalcAndBubbleUp(task.parent_id);
  }
}

/**
 * التراجع عن الإنجاز (إن احتجنا لاحقاً زر "تراجع"). يعيد حساب الأجداد أيضاً
 * لأن اكتمال المركبة التلقائي قد يحتاج إلغاء.
 */
export async function uncompleteTask(taskId) {
  const task = await db.tasks.get(taskId);
  if (!task) throw new Error('المهمة غير موجودة');

  await db.tasks.update(taskId, {
    status: 'pending',
    completed_at: null,
    updated_at: nowISO(),
  });

  if (task.parent_id) {
    await recalcAndBubbleUp(task.parent_id);
  }
}

// ============================================================
// الترك اليدوي (Abandoned) - بقرار صريح فقط، لا يوجد تلقائي
// ============================================================

export async function abandonTask(taskId) {
  const task = await db.tasks.get(taskId);
  if (!task) throw new Error('المهمة غير موجودة');

  await db.tasks.update(taskId, {
    status: 'abandoned',
    updated_at: nowISO(),
  });

  // ملاحظة مقصودة: المهمة المتروكة تبقى محسوبة ضمن مقام الأوراق عند حساب
  // تقدم والدها، لكنها لن تُحتسب كمكتملة - وبالتالي لن تصل المركبة الأم
  // لـ 100% تلقائياً طالما توجد ورقة متروكة بداخلها (سلوك متعمّد ومنطقي).
  if (task.parent_id) {
    await recalcAndBubbleUp(task.parent_id);
  }
}

// ============================================================
// إنشاء وحذف المهام
// ============================================================

/**
 * ينشئ مهمة جديدة (فردية أو مركبة، جذر أو فرعية).
 * إذا كانت فرعية تحت مركّبة مكتملة سابقاً بنسبة 100%، يُعاد حساب والدها
 * فوراً حتى تتراجع المركبة تلقائياً عن حالة "منجزة" (بفضل التصحيح أعلاه).
 */
export async function createTask({
  title,
  type = 'single',
  parentId = null,
  dueDate,
  addToDaily = false,
  listId = DEFAULT_LIST_ID,
}) {
  if (!title || !dueDate) {
    throw new Error('العنوان وتاريخ الاستحقاق مطلوبان');
  }

  const id = crypto.randomUUID();
  const now = nowISO();

  const task = {
    id,
    title,
    type,
    parent_id: parentId,
    list_id: parentId ? null : listId, // القوائم للمهام الجذرية فقط
    due_date: dueDate,
    original_due_date: dueDate,
    status: 'pending',
    is_in_daily_list: addToDaily,
    completed_at: null,
    deleted: false,
    created_at: now,
    updated_at: now,
  };

  await db.tasks.add(task);

  if (parentId) {
    await recalcAndBubbleUp(parentId);
  }

  return task;
}

/**
 * "حذف" مهمة وكل أبنائها المتعشّشين - لكن بشكل Soft Delete (تعليم deleted=true)
 * بدل الحذف الفعلي من الجدول. هذا ضروري لتتمكن المزامنة السحابية لاحقاً من
 * معرفة أن هذه المهمة حُذفت على جهاز آخر (الحذف الفعلي لا يترك أي أثر لمزامنته).
 * تبقى المهمة مخفية تماماً عن الواجهة في كل الشاشات رغم بقائها في القاعدة.
 */
export async function deleteTask(taskId) {
  const task = await db.tasks.get(taskId);
  if (!task) return;

  const idsToDelete = [taskId, ...(await collectAllDescendantIds(taskId))];
  const now = nowISO();

  await db.transaction('rw', db.tasks, async () => {
    for (const id of idsToDelete) {
      await db.tasks.update(id, { deleted: true, updated_at: now });
    }
  });

  if (task.parent_id) {
    await recalcAndBubbleUp(task.parent_id);
  }
}

// ============================================================
// الربط/فك الربط بقائمة اليوميات (قاعدة 5)
// ============================================================

/**
 * "نقل" مهمة فرعية لليوميات - نفس الكيان (نفس id)، فقط تُعلَّم كمربوطة.
 * أي تغيير حالة لاحق عليها ينعكس تلقائياً في كل مكان (لأنها ليست نسخة).
 */
/**
 * "نقل" مهمة لليوميات - نفس الكيان (نفس id)، فقط تُعلَّم كمربوطة.
 * إذا كانت هذه مهمة مركبة، يُربط معها **كل فروعها المتعشّشة تلقائياً**
 * (بأي عمق)، وتُوحَّد كلها على نفس تاريخ الاستحقاق المُختار.
 */
export async function linkToDailyList(taskId, dueDate = todayStr()) {
  const idsToUpdate = [taskId, ...(await collectAllDescendantIds(taskId))];
  const now = nowISO();

  await db.transaction('rw', db.tasks, async () => {
    for (const id of idsToUpdate) {
      await db.tasks.update(id, {
        is_in_daily_list: true,
        due_date: dueDate,
        updated_at: now,
      });
    }
  });
}

/**
 * فك ربط مهمة من اليوميات - بنفس المنطق التصاعدي: فك ربط مركبة يفك
 * ربط كل فروعها معها أيضاً (حتى لا تبقى فروع "يتيمة" في شاشة اليوم
 * بعد رجوع والدها منها).
 */
export async function unlinkFromDailyList(taskId) {
  const idsToUpdate = [taskId, ...(await collectAllDescendantIds(taskId))];
  const now = nowISO();

  await db.transaction('rw', db.tasks, async () => {
    for (const id of idsToUpdate) {
      await db.tasks.update(id, {
        is_in_daily_list: false,
        updated_at: now,
      });
    }
  });
}

/**
 * إعادة جدولة يدوية لتاريخ الاستحقاق (لا تمس original_due_date أبداً،
 * لأنه المرجع الثابت لحساب "هل ضاعت هذه المهمة أصلاً؟").
 */
export async function rescheduleTask(taskId, newDueDate) {
  await db.tasks.update(taskId, {
    due_date: newDueDate,
    updated_at: nowISO(),
  });
}

/**
 * يرجع كل المهام التي تظهر في "شاشة اليوم" لتاريخ معيّن.
 * القاعدة موحّدة الآن لكل الأنواع: تظهر المهمة في اليوميات إذا وفقط إذا
 * كانت is_in_daily_list = true (بغض النظر عن type أو كونها جذرية أو فرعية).
 * الربط والفك يدويان بالكامل ومتاحان لأي مهمة.
 */
export async function getDailyList(dateStr = todayStr()) {
  const tasksForDate = await db.tasks.where('due_date').equals(dateStr).toArray();
  return tasksForDate.filter((t) => t.is_in_daily_list && !t.deleted);
}

// ============================================================
// منطق "الضياع" (Missed) + الترحيل التلقائي (Rollover)
// ============================================================

/**
 * تُشغَّل مرة واحدة عند فتح التطبيق (أو عبر مؤقّت يومي).
 * أي مهمة pending وتاريخ استحقاقها الحالي أقدم من اليوم تُرحَّل تلقائياً
 * إلى تاريخ اليوم. original_due_date لا يتغيّر أبداً - فهو المرجع الثابت
 * لحساب "هل ضاعت هذه المهمة أصلاً؟" بغض النظر عن الترحيل.
 */
export async function rolloverMissedTasks() {
  const today = todayStr();

  const missed = await db.tasks
    .where('status')
    .equals('pending')
    .filter((t) => t.due_date < today)
    .toArray();

  for (const t of missed) {
    await db.tasks.update(t.id, {
      due_date: today,
      updated_at: nowISO(),
    });
  }

  return missed.length; // عدد المهام التي رُحّلت (للعرض الاختياري للمستخدم)
}

/**
 * يحدد هل مهمة معيّنة "ضائعة" حسب القاعدة: تجاوزت original_due_date
 * ولو بيوم واحد، بغض النظر متى أُنجزت لاحقاً (أو حتى لو لم تُنجز بعد).
 */
export function isMissed(task) {
  const referenceDate = task.completed_at
    ? task.completed_at.slice(0, 10)
    : todayStr();

  return referenceDate > task.original_due_date;
}

/**
 * يصنّف مهمة منتهية إلى واحدة من ثلاث فئات لشاشة الإحصائيات:
 * "completed" (أُنجزت في وقتها) | "missed_then_completed" | "abandoned"
 * يرجع null إذا كانت المهمة لا تزال pending (لا تدخل في الإحصائيات بعد).
 */
export function classifyForStats(task) {
  if (task.status === 'abandoned') return 'abandoned';

  if (task.status === 'completed') {
    return isMissed(task) ? 'missed_then_completed' : 'completed';
  }

  return null;
}



  // ============================================================
// إدارة القوائم (Lists)
// ============================================================

export async function getLists() {
  const lists = await db.lists.toArray();
  return lists.filter((l) => !l.deleted).sort((a, b) => a.order_index - b.order_index);
}

export async function createList(name) {
  if (!name || !name.trim()) {
    throw new Error('اسم القائمة مطلوب');
  }

  const existing = await getLists();
  const id = crypto.randomUUID();
  const now = nowISO();

  const list = {
    id,
    name: name.trim(),
    color: null,
    order_index: existing.length,
    deleted: false,
    created_at: now,
    updated_at: now,
  };

  await db.lists.add(list);
  return list;
}

export async function renameList(listId, newName) {
  if (!newName || !newName.trim()) {
    throw new Error('اسم القائمة مطلوب');
  }
  await db.lists.update(listId, { name: newName.trim(), updated_at: nowISO() });
}


/**
 * حذف قائمة (Soft delete) - المهام الجذرية التي كانت بداخلها تُنقل تلقائياً
 * للقائمة الافتراضية "عام" حتى لا "تضيع" أو تصبح بلا قائمة ظاهرة.
 * لا يجوز حذف القائمة الافتراضية نفسها.
 */
export async function deleteList(listId) {
  if (listId === DEFAULT_LIST_ID) {
    throw new Error('لا يمكن حذف القائمة الافتراضية');
  }

  const now = nowISO();

  await db.transaction('rw', db.lists, db.tasks, async () => {
    await db.lists.update(listId, { deleted: true, updated_at: now });

    const affectedTasks = await db.tasks.where('list_id').equals(listId).toArray();
    for (const t of affectedTasks) {
      await db.tasks.update(t.id, { list_id: DEFAULT_LIST_ID, updated_at: now });
    }
  });
}
