// نقاط API:
// GET  /api/tasks?device_id=xxx        -> يرجع كل مهام هذا الجهاز (سحب/pull)
// POST /api/tasks/sync                 -> يستقبل { device_id, tasks: [...] } ويحفظها (دفع/push)
//
// لا يوجد تسجيل دخول أو أي حماية - device_id هو المعرّف الوحيد، حسب تصميم
// المشروع الأصلي (شخصي، بدون حسابات). هذا يعني أن أي شخص يعرف الـ device_id
// يمكنه قراءة/تعديل تلك البيانات - مقبول لمشروع شخصي غير حساس.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function rowToTask(row) {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    parent_id: row.parent_id,
    list_id: row.list_id,
    due_date: row.due_date,
    original_due_date: row.original_due_date,
    status: row.status,
    is_in_daily_list: !!row.is_in_daily_list,
    deleted: !!row.deleted,
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
function rowToList(row) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    order_index: row.order_index,
    deleted: !!row.deleted,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      // ---------- GET /api/tasks?device_id=xxx (سحب) ----------
      if (url.pathname === '/api/tasks' && request.method === 'GET') {
        const deviceId = url.searchParams.get('device_id');
        if (!deviceId) return jsonResponse({ error: 'device_id مطلوب' }, 400);

        const { results } = await env.DB.prepare('SELECT * FROM tasks WHERE device_id = ?')
          .bind(deviceId)
          .all();

        return jsonResponse({ tasks: results.map(rowToTask) });
      }

      // ---------- POST /api/tasks/sync (دفع) ----------
      if (url.pathname === '/api/tasks/sync' && request.method === 'POST') {
        const body = await request.json();
        const { device_id, tasks } = body;

        if (!device_id || !Array.isArray(tasks)) {
          return jsonResponse({ error: 'device_id و tasks (مصفوفة) مطلوبان' }, 400);
        }

        let syncedCount = 0;

        for (const t of tasks) {
          // تجاهل أي سجل ناقص الحقول الأساسية بدل تعطيل كل عملية المزامنة
          if (!t.id || !t.title || !t.type || !t.updated_at) continue;

          const existing = await env.DB.prepare('SELECT updated_at FROM tasks WHERE id = ?')
            .bind(t.id)
            .first();

          // Last-write-wins: لا نكتب فوق نسخة أحدث أو مطابقة موجودة بالفعل
          if (existing && existing.updated_at >= t.updated_at) continue;

         await env.DB.prepare(
            `INSERT INTO tasks
               (id, device_id, title, type, parent_id, list_id, due_date, original_due_date,
                status, is_in_daily_list, deleted, completed_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               title = excluded.title,
               type = excluded.type,
               parent_id = excluded.parent_id,
               list_id = excluded.list_id,
               due_date = excluded.due_date,
               original_due_date = excluded.original_due_date,
               status = excluded.status,
               is_in_daily_list = excluded.is_in_daily_list,
               deleted = excluded.deleted,
               completed_at = excluded.completed_at,
               updated_at = excluded.updated_at`
          )
            .bind(
              t.id,
              device_id,
              t.title,
              t.type,
              t.parent_id || null,
              t.list_id || null,
              t.due_date,
              t.original_due_date,
              t.status,
              t.is_in_daily_list ? 1 : 0,
              t.deleted ? 1 : 0,
              t.completed_at || null,
              t.created_at,
              t.updated_at
            )
            .run();

          syncedCount++;
        }

        return jsonResponse({ synced: syncedCount });
      }
      
// ---------- GET /api/lists?device_id=xxx (سحب القوائم) ----------
      if (url.pathname === '/api/lists' && request.method === 'GET') {
        const deviceId = url.searchParams.get('device_id');
        if (!deviceId) return jsonResponse({ error: 'device_id مطلوب' }, 400);

        const { results } = await env.DB.prepare('SELECT * FROM lists WHERE device_id = ?')
          .bind(deviceId)
          .all();

        return jsonResponse({ lists: results.map(rowToList) });
      }

      // ---------- POST /api/lists/sync (دفع القوائم) ----------
      if (url.pathname === '/api/lists/sync' && request.method === 'POST') {
        const body = await request.json();
        const { device_id, lists } = body;

        if (!device_id || !Array.isArray(lists)) {
          return jsonResponse({ error: 'device_id و lists (مصفوفة) مطلوبان' }, 400);
        }

        let syncedCount = 0;

        for (const l of lists) {
          if (!l.id || !l.name || !l.updated_at) continue;

          const existing = await env.DB.prepare('SELECT updated_at FROM lists WHERE id = ?')
            .bind(l.id)
            .first();

          if (existing && existing.updated_at >= l.updated_at) continue;

          await env.DB.prepare(
            `INSERT INTO lists
               (id, device_id, name, color, order_index, deleted, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               name = excluded.name,
               color = excluded.color,
               order_index = excluded.order_index,
               deleted = excluded.deleted,
               updated_at = excluded.updated_at`
          )
            .bind(
              l.id,
              device_id,
              l.name,
              l.color || null,
              l.order_index ?? 0,
              l.deleted ? 1 : 0,
              l.created_at,
              l.updated_at
            )
            .run();

          syncedCount++;
        }

        return jsonResponse({ synced: syncedCount });
      }
      return jsonResponse({ error: 'المسار غير موجود' }, 404);
    } catch (err) {
      return jsonResponse({ error: err.message }, 500);
    }
  },
};
