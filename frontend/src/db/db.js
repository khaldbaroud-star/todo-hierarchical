import Dexie from 'dexie';

// قاعدة البيانات المحلية الأساسية للتطبيق (IndexedDB عبر Dexie)
export const db = new Dexie('TodoHierarchicalDB');

// معرّف القائمة الافتراضية "عام" - ثابت حتى تتوافق معها كل الأجهزة والمزامنة
export const DEFAULT_LIST_ID = 'default-list';

// تعريف جدول المهام (tasks) والفهارس (indexes) المطلوبة للاستعلامات السريعة
// ملاحظة: أول عمود في القائمة (id) هو المفتاح الأساسي (Primary Key)
// باقي الأعمدة المذكورة هنا فقط هي التي نحتاج البحث/الفلترة بها بكثرة
db.version(1).stores({
  tasks: 'id, parent_id, due_date, status, is_in_daily_list, type, created_at'
});

// v2: إضافة خاصية القوائم (Lists). list_id يُخزَّن فقط على المهام الجذرية
// (المهام الفرعية بلا list_id - تظهر ضمن شجرة والدها تلقائياً).
db.version(2).stores({
  tasks: 'id, parent_id, due_date, status, is_in_daily_list, type, created_at, list_id',
  lists: 'id, order_index, deleted, created_at'
}).upgrade(async (tx) => {
  // مستخدم قديم يترقّى من v1 -> v2: ننشئ قائمة افتراضية ونربط كل مهامه
  // الجذرية الحالية بها تلقائياً حتى لا تختفي من الواجهة بعد التحديث
  const now = new Date().toISOString();

  await tx.table('lists').put({
    id: DEFAULT_LIST_ID,
    name: 'عام',
    color: null,
    order_index: 0,
    deleted: false,
    created_at: now,
    updated_at: now,
  });

  await tx.table('tasks').toCollection().modify((task) => {
    if (!task.parent_id && !task.list_id) {
      task.list_id = DEFAULT_LIST_ID;
    }
  });
});

// مستخدم جديد كلياً (لا توجد قاعدة بيانات سابقة عنده على الإطلاق):
// upgrade() أعلاه لا يُشغَّل في هذه الحالة لأن Dexie ينشئ القاعدة مباشرة
// عند آخر إصدار - لذلك نحتاج populate() لضمان وجود القائمة الافتراضية أيضاً هنا
db.on('populate', async () => {
  const now = new Date().toISOString();
  await db.lists.add({
    id: DEFAULT_LIST_ID,
    name: 'عام',
    color: null,
    order_index: 0,
    deleted: false,
    created_at: now,
    updated_at: now,
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
    due_date: string,           // "YYYY-MM-DD"
    original_due_date: string,  // "YYYY-MM-DD"
    status: "pending" | "completed" | "abandoned",
    is_in_daily_list: boolean,
    completed_at: string | null,   // ISO datetime
    created_at: string,            // ISO datetime
    updated_at: string              // ISO datetime
  }
*/

export default db;
