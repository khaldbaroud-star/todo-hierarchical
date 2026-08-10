import { db } from '../db/db';

/**
 * يجمع كل المهام ويحوّلها لملف JSON قابل للتنزيل مباشرة من المتصفح.
 */
export async function exportData() {
  const allTasks = await db.tasks.toArray();
  const tasks = allTasks.filter((t) => !t.deleted); // لا داعي لتصدير مهام محذوفة فعلياً

  const payload = {
    exported_at: new Date().toISOString(),
    version: 1,
    tasks,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `todo-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * يقرأ ملف JSON سابق ويستبدل به كل المهام الحالية بالكامل.
 * يرجع عدد المهام المستوردة عند النجاح، ويرمي خطأ واضح عند فشل التحقق.
 */
export async function importData(file) {
  const text = await file.text();

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error('الملف ليس بصيغة JSON صالحة');
  }

  if (!payload || !Array.isArray(payload.tasks)) {
    throw new Error('بنية الملف غير صحيحة: لا يوجد مصفوفة "tasks"');
  }

  // تحقق أساسي من كل مهمة قبل الاستيراد لتفادي إفساد القاعدة بسجلات ناقصة
  for (const t of payload.tasks) {
    if (!t.id || !t.title || !t.type) {
      throw new Error('إحدى المهام في الملف تفتقد حقولاً أساسية (id / title / type)');
    }
  }

  // نضمن وجود حقل deleted حتى عند استيراد نسخة احتياطية قديمة أُنشئت
  // قبل إضافة هذا الحقل، حتى لا تُعامَل كل مهامها كـ undefined لاحقاً
  const normalizedTasks = payload.tasks.map((t) => ({ deleted: false, ...t }));

  await db.transaction('rw', db.tasks, async () => {
    await db.tasks.clear();
    await db.tasks.bulkAdd(normalizedTasks);
  });

  return normalizedTasks.length;
}
