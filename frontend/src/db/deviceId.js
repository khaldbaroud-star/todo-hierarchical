// إدارة "هوية الجهاز" بدون أي نظام تسجيل دخول
// نستخدم localStorage (وليس Dexie) لأنه أبسط وسريع القراءة بشكل متزامن (synchronous)
// وهذه القيمة لا تحتاج فهرسة أو استعلامات - فقط قراءة/كتابة مرة واحدة

const DEVICE_ID_KEY = 'todo_app_device_id';

/**
 * يرجع UUID الجهاز الحالي. إذا لم يكن موجوداً، يولّد واحداً جديداً ويخزّنه.
 * هذا الـ UUID هو المفتاح الذي سيُستخدم لاحقاً في المرحلة 6 لربط
 * مهام هذا الجهاز بسجلات قاعدة بيانات Cloudflare D1.
 */
export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);

  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }

  return id;
}

/**
 * تسمح للمستخدم لاحقاً (من شاشة الإعدادات) بإدخال UUID جهاز آخر يدوياً
 * لتوحيد البيانات بين جهازين، حسب ما هو محدد في البرومبت الأصلي.
 */
export function setDeviceId(newId) {
  if (!newId || typeof newId !== 'string') {
    throw new Error('UUID غير صالح');
  }
  localStorage.setItem(DEVICE_ID_KEY, newId);
}
