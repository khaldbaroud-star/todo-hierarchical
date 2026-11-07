# خطة وتقدّم ميزة تسجيل الدخول عبر Google

> يوثّق هذا الملف كل ما نوقش واتُّخذ من قرارات ونُفّذ فعلياً بخصوص استبدال/تكميل `device_id` بتسجيل دخول حقيقي عبر Google. يُستخدم كسياق كامل عند بدء محادثة جديدة للمتابعة على هذا البند تحديداً (البند 5️⃣ في `fixes-plan-v2.md`).

---

## 1. القرارات المعتمدة

| السؤال | القرار |
|---|---|
| عدد المستخدمين | في البداية "أي شخص يملك بريدي" (شخص واحد فعلياً)، ثم تغيّر لاحقاً إلى: **أي شخص لديه حساب Google** (مفتوح للجميع) |
| طريقة تسجيل الدخول | **Google Sign-In** (زر يعرض منتقي الحسابات المسجّلة في الجهاز) — تم التخلي نهائياً عن فكرة Magic Link عبر البريد (Resend) |
| مدة الجلسة | **90 يوماً** — الجهاز يبقى مسجَّل دخوله لمدة 90 يوماً قبل الحاجة لإعادة تسجيل الدخول |
| تسجيل الدخول إلزامي أم اختياري | **اختياري** — التطبيق يبقى يعمل بالكامل أوفلاين/بدون حساب تماماً كما هو الآن؛ تسجيل الدخول يضيف فقط توحيد الهوية بين الأجهزة |
| النشر (Publishing) | التطبيق حالياً في وضعية **Testing** أثناء الإعداد، وسيُنشر (Publish) للسماح لأي حساب Google بالدخول، بدون طلب صلاحيات حساسة (فقط البريد والاسم الأساسيين) |

---

## 2. الفكرة المعمارية الأساسية

**لا حاجة لأي تعديل في `schema.sql`.** عمود `device_id` الموجود أصلاً في جدولي `tasks` و`lists` يبقى كما هو — فقط **القيمة** المخزَّنة فيه تختلف حسب حالة الطلب:

- **بدون تسجيل دخول**: القيمة تبقى UUID الجهاز العشوائي (كما هو الحال اليوم، بلا أي تغيير).
- **مع تسجيل دخول عبر Google**: القيمة تصبح `acct:google:<sub>` حيث `sub` هو المعرّف الثابت والفريد لحساب Google (لا يتغيّر حتى لو غيّر المستخدم بريده الإلكتروني لاحقاً).

هذا يعني أن كل حساب Google يحصل تلقائياً على "مساحة بيانات" معزولة تماماً، تماماً بنفس منطق عزل `device_id` الحالي — بدون الحاجة لأي جدول مستخدمين (`users`) منفصل.

---

## 3. ما تم تنفيذه فعلياً في `worker/src/index.js`

### أ) أدوات JWT (تمت إضافتها بالكامل)
- دوال `base64UrlEncode` / `base64UrlDecodeToBytes` / إلخ — أدوات ترميز مساعدة.
- `createSessionToken(payload, secret)` — يُنشئ توكن جلستنا الخاص (HS256)، موقَّع بسرّ `AUTH_SECRET`.
- `verifySessionToken(token, secret)` — يتحقق من توقيع وصلاحية توكن الجلسة.
- `getGooglePublicKeys()` — يجلب مفاتيح Google العامة (JWKS) مع تخزين مؤقت لمدة ساعة.
- `verifyGoogleIdToken(idToken, expectedClientId)` — يتحقق الكامل من توكن Google: المُصدر (`iss`)، الجمهور (`aud`)، الصلاحية، تأكيد البريد، وتوقيع RSA.

### ب) مسار تسجيل الدخول: `POST /api/auth/google`
يستقبل `{ credential }` (توكن Google ID)، يتحقق منه عبر `verifyGoogleIdToken`، ثم يُنشئ توكن جلسة خاص بنا صالح لـ 90 يوماً، ويرجع:
```json
{ "session_token": "...", "account_id": "acct:google:...", "email": "..." }
```
✅ **تم اختباره فعلياً ونجح** عبر صفحة اختبار مستقلة (`google-signin-test.html`) على `http://localhost:5173`.

### ج) حماية المسارات الحالية
دالة جديدة `resolveDeviceId(request, env, fallbackDeviceId)`:
- إذا وُجد `Authorization: Bearer <توكن جلسة صالح>` → تُستخدم هوية الحساب (`acct:google:...`) بدل `device_id` المُرسَل من العميل مهما كانت قيمته.
- غير ذلك → يُستخدم `device_id` كالمعتاد (يحافظ على عمل التطبيق أوفلاين/بدون حساب).

طُبّقت هذه الدالة على المسارات الأربعة التالية:
- `GET /api/tasks`
- `POST /api/tasks/sync`
- `GET /api/lists`
- `POST /api/lists/sync`

---

## 4. إعداد Google Cloud Console (تم فعلياً)

- **Client ID**: `2066874989-tos3acd82rmura5hcr20cf8lt5qo5nb3.apps.googleusercontent.com` (قيمة عامة غير حسّاسة)
- **نوع بيانات الاعتماد**: OAuth Client ID → Web application
- **Authorized JavaScript origins**: `https://todo-hierarchical.pages.dev` و `http://localhost:5173` (للاختبار المحلي)
- **Authorized redirect URIs**: تُركت فارغة عمداً — غير مطلوبة لتدفّق Google Identity Services (الزر/منتقي الحسابات)
- تم ضبط `GOOGLE_CLIENT_ID` كمتغيّر عام (`[vars]`) في `worker/wrangler.toml` (قيمة عامة، ليست سرّاً)
- تم ضبط `AUTH_SECRET` كسرّ Cloudflare عبر `wrangler secret put AUTH_SECRET` (سلسلة عشوائية طويلة، لتوقيع توكنات جلستنا الخاصة فقط)

### مشكلة واجهها المستخدم وحلّها
عند محاولة تفعيل وضعية **Publish** (بدل Testing) ظهرت رسالة: *"To publish your app, you must complete your configuration on the Branding page."* — الحل: إكمال حقول تبويب **Branding** في OAuth consent screen (اسم التطبيق، بريد الدعم، بيانات تواصل المطوّر) ثم إعادة محاولة النشر.

### ملاحظة معلّقة لم تُختبر بعد
عند النشر الفعلي، قد يطلب Google حقل **Authorized domains** مملوكاً فعلياً من طرفك. نطاق `todo-hierarchical.pages.dev` هو نطاق فرعي عام مشترك (وليس نطاقاً خاصاً مملوكاً)، وقد يرفضه Google لهذا السبب تحديداً. **البديل الجاهز إذا حصل هذا**: البقاء في وضعية Testing وزيادة قائمة Test users يدوياً (الحد الأقصى المسموح دون نشر هو 100 مستخدم اختباري) بدل النشر الكامل.

---

## 5. ما تبقّى (لم يُنفَّذ بعد)

1. **تأكيد نجاح النشر (Publish)** بعد إكمال Branding، أو التبديل لبديل "زيادة Test users" إذا ظهرت مشكلة النطاق.
2. **`POST /api/account/migrate`** — مسار جديد يُعيد تعيين كل مهام/قوائم جهاز معيّن (المعرَّفة بـ `device_id` القديم) إلى `acct:google:...` بعد أول تسجيل دخول، عبر:
   ```sql
   UPDATE tasks SET device_id = ? WHERE device_id = ?;
   UPDATE lists SET device_id = ? WHERE device_id = ?;
   ```
   محمي بالتحقق من توكن الجلسة (لا يُسمح بتمرير أي `device_id`/`account_id` من العميل مباشرة بدون تحقق).
3. **الواجهة الأمامية بالكامل** (لم يبدأ العمل عليها بعد):
   - ملف جديد `frontend/src/auth/authClient.js` — تحميل مكتبة Google Identity Services، عرض الزر، إرسال `credential` إلى `/api/auth/google`، تخزين/قراءة توكن الجلسة محلياً (بنفس نمط `deviceId.js`)، والتحقق من انتهاء الصلاحية.
   - تعديل `frontend/src/sync/syncClient.js` — إرسال `Authorization: Bearer <token>` عند وجود جلسة نشطة، مع الإبقاء على `device_id` كبديل احتياطي.
   - تعديل `frontend/src/pages/SettingsPage.jsx` — إضافة واجهة تسجيل الدخول (زر Google، عرض البريد بعد الدخول، زر خروج)، وزر "ربط بيانات هذا الجهاز بحسابي" لتفعيل مسار الترحيل لأول مرة.
   - إضافة معالجة لإعادة توجيه/استدعاء Google بعد اختيار الحساب (غالباً عبر callback مباشر في الصفحة نفسها، بلا حاجة لصفحة منفصلة، لأن Google Identity Services لا يستخدم redirect تقليدي).
4. **اختبار طرف-لطرف**: تسجيل دخول من الهاتف وجهاز آخر بنفس حساب Google، تأكيد ظهور نفس المهام على الاثنين بعد المزامنة والترحيل.

---

## 6. الملفات المتأثرة (إجمالاً)

| الملف | الحالة |
|---|---|
| `worker/src/index.js` | ✅ عُدِّل ونُشر (auth + حماية المسارات) |
| `worker/wrangler.toml` | ✅ عُدِّل (`GOOGLE_CLIENT_ID`) |
| Cloudflare secret `AUTH_SECRET` | ✅ تم ضبطه |
| `worker/src/index.js` (مسار الترحيل) | ⏳ لم يُنفَّذ |
| `frontend/src/auth/authClient.js` | ⏳ لم يُنشأ |
| `frontend/src/sync/syncClient.js` | ⏳ لم يُعدَّل |
| `frontend/src/pages/SettingsPage.jsx` | ⏳ لم يُعدَّل |
