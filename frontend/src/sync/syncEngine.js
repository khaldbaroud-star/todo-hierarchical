import { db } from '../db/db';
import { getDeviceId } from '../db/deviceId';
import { pullTasks, pushTasks, pullLists, pushLists } from './syncClient';

/**
 * مزامنة كاملة عند الطلب (وليست طابور تغييرات لكل حركة صغيرة):
 * 1) يدفع كل المهام والقوائم المحلية للخادم (الخادم يتجاهل أي نسخة أقدم تلقائياً)
 * 2) يسحب كل مهام وقوائم هذا الجهاز من الخادم
 * 3) يدمجها محلياً: يكتب فوق أي سجل محلي فقط إذا كانت نسخة الخادم أحدث
 *
 * ملاحظة مهمة (قيد معروف حالياً): لا يوجد تتبّع كامل للحذف عبر الأجهزة بعد
 * (راجع البند 4 في fixes-plan-v2.md) - deleted موجود في D1 لكن الواجهة
 * لا تزال تحذف محلياً بشكل صريح دون فلترة/نشر الحذف بشكل كامل.
 */
export async function syncNow() {
  const deviceId = getDeviceId();

  const localTasks = await db.tasks.toArray();
  const localLists = await db.lists.toArray();

  await pushTasks(deviceId, localTasks);
  await pushLists(deviceId, localLists);

  const serverTasks = await pullTasks(deviceId);
  const serverLists = await pullLists(deviceId);

  let updatedCount = 0;
  for (const serverTask of serverTasks) {
    const localTask = await db.tasks.get(serverTask.id);
    if (!localTask || serverTask.updated_at > localTask.updated_at) {
      await db.tasks.put(serverTask);
      updatedCount++;
    }
  }

  let updatedListsCount = 0;
  for (const serverList of serverLists) {
    const localList = await db.lists.get(serverList.id);
    if (!localList || serverList.updated_at > localList.updated_at) {
      await db.lists.put(serverList);
      updatedListsCount++;
    }
  }

  return {
    pushed: localTasks.length,
    pulledTotal: serverTasks.length,
    updatedLocally: updatedCount,
    pushedLists: localLists.length,
    pulledListsTotal: serverLists.length,
    updatedListsLocally: updatedListsCount,
  };
}
