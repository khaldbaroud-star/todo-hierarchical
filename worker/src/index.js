// /api/auth/google
// GET  /api/tasks?device_id=xxx        -> يرجع كل مهام هذا الجهاز (سحب/pull)
// POST /api/tasks/sync                 -> يستقبل { device_id, tasks: [...] } ويحفظها (دفع/push)
// GET  /api/lists?device_id=xxx        -> يرجع كل قوائم هذا الجهاز (سحب/pull)
// POST /api/lists/sync                 -> يستقبل { device_id, lists: [...] } ويحفظها (دفع/push)
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

// ============================================================
// أدوات JWT: توقيع/تحقق جلستنا الخاصة (HS256) + تحقق توكن Google (RS256)
// ============================================================

function base64UrlEncode(bytes) {
  let binary = '';
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.byteLength; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecodeToBytes(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlDecodeToString(str) {
  return new TextDecoder().decode(base64UrlDecodeToBytes(str));
}

function base64UrlEncodeString(str) {
  return base64UrlEncode(new TextEncoder().encode(str));
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

// ينشئ توكن جلستنا الخاص (صالح لمدة معيّنة، موقّع بـ AUTH_SECRET)
async function createSessionToken(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerPart = base64UrlEncodeString(JSON.stringify(header));
  const payloadPart = base64UrlEncodeString(JSON.stringify(payload));
  const unsigned = `${headerPart}.${payloadPart}`;

  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(unsigned));
  const signaturePart = base64UrlEncode(signature);

  return `${unsigned}.${signaturePart}`;
}

// يتحقق من توكن جلستنا الخاص - يرجع null إذا كان غير صالح أو منتهي الصلاحية
async function verifySessionToken(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signaturePart] = parts;
  const unsigned = `${headerPart}.${payloadPart}`;

  const key = await importHmacKey(secret);
  const signatureBytes = base64UrlDecodeToBytes(signaturePart);
  const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, new TextEncoder().encode(unsigned));
  if (!valid) return null;

  const payload = JSON.parse(base64UrlDecodeToString(payloadPart));
  if (payload.exp && Date.now() / 1000 > payload.exp) return null;

  return payload;
}

// ---------- تحقق توكن Google (ID token) ----------

let cachedGoogleKeys = null;
let cachedGoogleKeysExpiry = 0;

async function getGooglePublicKeys() {
  if (cachedGoogleKeys && Date.now() < cachedGoogleKeysExpiry) {
    return cachedGoogleKeys;
  }
  const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!res.ok) throw new Error('تعذّر جلب مفاتيح Google العامة');
  const data = await res.json();
  cachedGoogleKeys = data.keys;
  cachedGoogleKeysExpiry = Date.now() + 60 * 60 * 1000; // ساعة واحدة
  return cachedGoogleKeys;
}

async function verifyGoogleIdToken(idToken, expectedClientId) {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('شكل التوكن غير صالح');
  const [headerPart, payloadPart, signaturePart] = parts;

  const header = JSON.parse(base64UrlDecodeToString(headerPart));
  const payload = JSON.parse(base64UrlDecodeToString(payloadPart));

  const validIssuers = ['https://accounts.google.com', 'accounts.google.com'];
  if (!validIssuers.includes(payload.iss)) throw new Error('مُصدر التوكن غير صحيح');
  if (payload.aud !== expectedClientId) throw new Error('هذا التوكن غير موجّه لهذا التطبيق');
  if (!payload.exp || Date.now() / 1000 > payload.exp) throw new Error('التوكن منتهي الصلاحية');
  if (payload.email_verified === false) throw new Error('البريد الإلكتروني غير مؤكَّد من Google');

  const keys = await getGooglePublicKeys();
  const matchingKey = keys.find((k) => k.kid === header.kid);
  if (!matchingKey) throw new Error('لم يُعثر على مفتاح مطابق للتحقق من التوقيع');

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    matchingKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signatureBytes = base64UrlDecodeToBytes(signaturePart);
  const signedData = new TextEncoder().encode(`${headerPart}.${payloadPart}`);

  const isValid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signatureBytes, signedData);
  if (!isValid) throw new Error('فشل التحقق من توقيع التوكن');

  return payload; // يحوي sub, email, name, picture...
}

// ---------- تحديد هوية الطلب: جلسة مسجّلة (Google) أو device_id تقليدي ----------
// إذا وُجد Authorization: Bearer <توكن جلسة صالح> نستخدم حساب المستخدم المسجّل
// (acct:google:...) بدل device_id المُرسَل، مهما كانت قيمته. غير ذلك نستخدم
// device_id كالمعتاد - هذا يحافظ على عمل التطبيق بدون تسجيل دخول.
async function resolveDeviceId(request, env, fallbackDeviceId) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = await verifySessionToken(token, env.AUTH_SECRET);
    if (payload && payload.account_id) {
      return payload.account_id;
    }
  }
  return fallbackDeviceId;
}

function rowToList(row) {
  return {
    id: row.id,
    name: row.name,
    parent_list_id: row.parent_list_id,
    order: row.list_order,
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
      // ---------- POST /api/auth/google (تسجيل الدخول عبر Google) ----------
      if (url.pathname === '/api/auth/google' && request.method === 'POST') {
        const body = await request.json();
        const { credential } = body;

        if (!credential) {
          return jsonResponse({ error: 'credential مطلوب' }, 400);
        }

        let googlePayload;
        try {
          googlePayload = await verifyGoogleIdToken(credential, env.GOOGLE_CLIENT_ID);
        } catch (err) {
          return jsonResponse({ error: 'فشل التحقق من حساب Google: ' + err.message }, 401);
        }

        const accountId = `acct:google:${googlePayload.sub}`;
        const now = Math.floor(Date.now() / 1000);
        const ninetyDaysInSeconds = 90 * 24 * 60 * 60;

        const sessionToken = await createSessionToken(
          {
            account_id: accountId,
            email: googlePayload.email,
            iat: now,
            exp: now + ninetyDaysInSeconds,
          },
          env.AUTH_SECRET
        );

        return jsonResponse({
          session_token: sessionToken,
          account_id: accountId,
          email: googlePayload.email,
        });
      }

      // ---------- GET /api/tasks?device_id=xxx (سحب) ----------
      if (url.pathname === '/api/tasks' && request.method === 'GET') {
        const deviceIdParam = url.searchParams.get('device_id');
        const deviceId = await resolveDeviceId(request, env, deviceIdParam);
        if (!deviceId) return jsonResponse({ error: 'device_id مطلوب (أو سجّل الدخول)' }, 400);

        const { results } = await env.DB.prepare('SELECT * FROM tasks WHERE device_id = ?')
          .bind(deviceId)
          .all();

        return jsonResponse({ tasks: results.map(rowToTask) });
      }

      // ---------- POST /api/tasks/sync (دفع) ----------
      if (url.pathname === '/api/tasks/sync' && request.method === 'POST') {
        const body = await request.json();
        const { device_id, tasks } = body;
        const deviceId = await resolveDeviceId(request, env, device_id);

        if (!deviceId || !Array.isArray(tasks)) {
          return jsonResponse({ error: 'device_id (أو تسجيل دخول) و tasks (مصفوفة) مطلوبان' }, 400);
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
              deviceId,
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

      // ---------- GET /api/lists?device_id=xxx (سحب) ----------
      if (url.pathname === '/api/lists' && request.method === 'GET') {
        const deviceIdParam = url.searchParams.get('device_id');
        const deviceId = await resolveDeviceId(request, env, deviceIdParam);
        if (!deviceId) return jsonResponse({ error: 'device_id مطلوب (أو سجّل الدخول)' }, 400);

        const { results } = await env.DB.prepare('SELECT * FROM lists WHERE device_id = ?')
          .bind(deviceId)
          .all();

        return jsonResponse({ lists: results.map(rowToList) });
      }

      // ---------- POST /api/lists/sync (دفع) ----------
      if (url.pathname === '/api/lists/sync' && request.method === 'POST') {
        const body = await request.json();
        const { device_id, lists } = body;
        const deviceId = await resolveDeviceId(request, env, device_id);

        if (!deviceId || !Array.isArray(lists)) {
          return jsonResponse({ error: 'device_id (أو تسجيل دخول) و lists (مصفوفة) مطلوبان' }, 400);
        }

        let syncedCount = 0;

        for (const l of lists) {
          // تجاهل أي سجل ناقص الحقول الأساسية بدل تعطيل كل عملية المزامنة
          if (!l.id || !l.name || !l.updated_at) continue;

          const existing = await env.DB.prepare('SELECT updated_at FROM lists WHERE id = ?')
            .bind(l.id)
            .first();

          // Last-write-wins: لا نكتب فوق نسخة أحدث أو مطابقة موجودة بالفعل
          if (existing && existing.updated_at >= l.updated_at) continue;

          await env.DB.prepare(
            `INSERT INTO lists
               (id, device_id, name, parent_list_id, list_order, deleted, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               name = excluded.name,
               parent_list_id = excluded.parent_list_id,
               list_order = excluded.list_order,
               deleted = excluded.deleted,
               updated_at = excluded.updated_at`
          )
            .bind(
              l.id,
              deviceId,
              l.name,
              l.parent_list_id || null,
              l.order || 0,
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
