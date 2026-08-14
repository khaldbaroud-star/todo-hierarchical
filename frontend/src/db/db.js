import Dexie from 'dexie';

// قاعدة البيانات المحلية الأساسية للتطبيق (IndexedDB عبر Dexie)
export const db = new Dexie('TodoHierarchicalDB');

export const DEFAULT_LIST_ID = 'default-list';

// تعريف جدول المهام (tasks) والفهارس (indexes) المطلوبة للاستعلامات السريعة
// ملاحظة: أول عمود في القائمة (id) هو المفتاح الأساسي (Primary Key)
// باقي الأعمدة المذكورة هنا فقط هي التي نحتاج البحث/الفلترة بها بكثرة
db.version(1).stores({
  tasks: 'id, parent_id, due_date, status, is_in_daily_list, type, created_at',
});

// الإصدار 2: إضافة جدول القوائم المتعشّشة (lists) + ربط المهام الجذرية بها
// عبر list_id. القوائم تتعشّش عبر parent_list_id تماماً كتعشيش المهام.
db.version(2)
  .stores({
    tasks: 'id, parent_id, due_date, status, is_in_daily_list, type, created_at, list_id',
    lists: 'id, parent_list_id, order, deleted',
  })
  .upgrade(async (tx) => {
    const now = new Date().toISOString();

    // قائمة افتراضية جذرية "عام" لتوافق البيانات القديمة
    await tx.table('lists').add({
      id: DEFAULT_LIST_ID,
      name: 'عام',
      parent_list_id: null,
      order: 0,
      deleted: false,
      created_at: now,
      updated_at: now,
    });

    // كل مهمة جذرية موجودة مسبقاً تُربط تلقائياً بالقائمة الافتراضية
    await tx
      .table('tasks')
      .toCollection()
      .modify((task) => {
        if (!task.parent_id) {
          task.list_id = DEFAULT_LIST_ID;
        }
      });
  });

/*
  شكل كل صف (Task) داخل الجدول - غير ملزم بالبنية طالما id موجود,
  لكن هذا هو الشكل الذي سنعتمده في كل التطبيق:

  {
    id: string,                 // UUID
    title: string,
    type: "single" | "composite",
    parent_id: string | null,
    list_id: string | null,     // فقط للمهام الجذرية (parent_id = null)
    due_date: string,           // "YYYY-MM-DD"
    original_due_date: string,  // "YYYY-MM-DD"
    status: "pending" | "completed" | "abandoned",
    is_in_daily_list: boolean,
    completed_at: string | null,   // ISO datetime
    created_at: string,            // ISO datetime
    updated_at: string              // ISO datetime
  }

  شكل كل صف (List) داخل جدول lists:
  {
    id: string,                    // UUID
    name: string,
    parent_list_id: string | null, // تعشيش القوائم
    order: number,
    deleted: boolean,
    created_at: string,
    updated_at: string
  }
*/

export default db;
