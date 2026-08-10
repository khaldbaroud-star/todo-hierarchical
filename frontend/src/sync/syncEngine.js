import { db } from '../db/db';
import { getDeviceId } from '../db/deviceId';
import { pullTasks, pushTasks } from './syncClient';

/**
 * مزامنة كاملة عند الطلب (وليست طابور تغييرات لكل حركة صغيرة):
 * 1) يدفع كل المهام المحلية للخادم (الخادم يتجاهل أي نسخة أقدم تلقائياً)
 * 2) يسحب كل مهام هذا الجهاز من الخادم
 * 3) يدمجها محلياً: يكتب فوق أي مهمة محلية فقط إذا كانت نسخة الخادم أحدث
 *
 * ملاحظة مهمة (قيد معروف حالياً): لا يوجد تتبّع للحذف (tombstones) بعد،
 * فحذف مهمة محلياً لا يُبلَّغ للخادم ولن يُحذف من هناك. هذا تبسيط مقصود
 * للمرحلة الحالية - يمكن إضافة حقل deleted_at لاحقاً إذا احتجت حذفاً متزامناً.
 */
export async function syncNow() {
  const deviceId = getDeviceId();

  const localTasks = await db.tasks.toArray();
  await pushTasks(deviceId, localTasks);

  const serverTasks = await pullTasks(deviceId);

  let updatedCount = 0;
  for (const serverTask of serverTasks) {
    const localTask = await db.tasks.get(serverTask.id);
    if (!localTask || serverTask.updated_at > localTask.updated_at) {
      await db.tasks.put(serverTask);
      updatedCount++;
    }
  }

  return {
    pushed: localTasks.length,
    pulledTotal: serverTasks.length,
    updatedLocally: updatedCount,
  };
}
