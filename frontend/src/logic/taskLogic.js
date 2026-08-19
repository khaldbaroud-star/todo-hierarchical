import { db } from '../db/db';

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
 * يُستخدم لتفعيل "الربط التصاعدي" باليوميات: ربط/فك ربط مركبة يشمل كل فروعها،
 * وأيضاً لحذف قائمة كاملة (listLogic.js) حيث نحتاج حذف كل أبناء كل مهمة جذرية.
 */
export async function collectAllDescendantIds(taskId) {
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
 *
 * listId: مطلوب فقط عند إنشاء مهمة جذرية (parentId = null)، لأن كل مهمة
 * جذرية يجب أن تنتمي لقائمة. المهام الفرعية ترث انتماءها لقائمة أقرب جد
 * جذري لها ضمنياً (بلا حاجة لتخزين list_id بها بشكل مباشر).
 */
export async function createTask({
  title,
  type = 'single',
  parentId = null,
  dueDate,
  addToDaily = false,
  listId = null,
}) {
  if (!title || !dueDate) {
    throw new Error('العنوان وتاريخ الاستحقاق مطلوبان');
  }
  if (!parentId && !listId) {
    throw new Error('المهام الجذرية يجب أن تنتمي لقائمة (listId مطلوب)');
  }

  const id = crypto.randomUUID();
  const now = nowISO();

  const task = {
    id,
    title,
    type,
    parent_id: parentId,
    list_id: parentId ? null : listId,
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
 * الربط والفك يدويان بالكامل ومتاحان لأي مهمة، بغض النظر عن القائمة التي
 * تنتمي إليها - شاشة اليوم موحّدة عبر كل القوائم بقرار تصميمي.
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
  if (!task.is_in_daily_list) return false;

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
