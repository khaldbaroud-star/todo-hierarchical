const API_BASE = 'https://todo-worker.khaldbaroud.workers.dev';

/**
 * سحب (pull): يرجع كل مهام هذا الجهاز المخزّنة على الخادم.
 */
export async function pullTasks(deviceId) {
  const res = await fetch(`${API_BASE}/api/tasks?device_id=${encodeURIComponent(deviceId)}`);
  if (!res.ok) {
    throw new Error(`فشل السحب من الخادم (${res.status})`);
  }
  const data = await res.json();
  return data.tasks;
}

/**
 * دفع (push): يرسل كل المهام المحلية للخادم. الخادم يطبّق last-write-wins
 * بنفسه بالاعتماد على updated_at، فلا خطورة من إرسال كل شيء دفعة واحدة.
 */
export async function pushTasks(deviceId, tasks) {
  const res = await fetch(`${API_BASE}/api/tasks/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: deviceId, tasks }),
  });
  if (!res.ok) {
    throw new Error(`فشل الدفع للخادم (${res.status})`);
  }
  const data = await res.json();
  return data.synced;
}
