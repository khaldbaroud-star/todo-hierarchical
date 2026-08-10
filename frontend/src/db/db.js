import Dexie from 'dexie';

// قاعدة البيانات المحلية الأساسية للتطبيق (IndexedDB عبر Dexie)
export const db = new Dexie('TodoHierarchicalDB');

// تعريف جدول المهام (tasks) والفهارس (indexes) المطلوبة للاستعلامات السريعة
// ملاحظة: أول عمود في القائمة (id) هو المفتاح الأساسي (Primary Key)
// باقي الأعمدة المذكورة هنا فقط هي التي نحتاج البحث/الفلترة بها بكثرة
db.version(1).stores({
  tasks: 'id, parent_id, due_date, status, is_in_daily_list, type, created_at'
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
