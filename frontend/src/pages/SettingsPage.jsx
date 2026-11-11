import { useRef, useState } from 'react';
import { getDeviceId, setDeviceId } from '../db/deviceId';
import { exportData, importData } from '../utils/exportImport';
import { syncNow } from '../sync/syncEngine';

const LAST_SYNC_KEY = 'todo_app_last_sync';

function SectionCard({ title, subtitle, children }) {
  return (
    <section
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-line)',
        borderRadius: 'var(--radius-lg)',
        padding: 20,
        marginBottom: 16,
      }}
    >
      <h2 style={{ fontSize: 16, margin: 0 }}>{title}</h2>
      {subtitle && <p style={{ color: 'var(--color-ink-soft)', fontSize: 13, marginTop: 4 }}>{subtitle}</p>}
      <div style={{ marginTop: 14 }}>{children}</div>
    </section>
  );
}

function Button({ children, onClick, variant = 'default' }) {
  const styles = {
    default: { background: 'var(--color-surface)', color: 'var(--color-ink)', border: '1px solid var(--color-line)' },
    primary: { background: 'var(--color-growth)', color: '#fff', border: '1px solid var(--color-growth)' },
  };
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 16px',
        borderRadius: 'var(--radius-md)',
        fontSize: 14,
        ...styles[variant],
      }}
    >
      {children}
    </button>
  );
}

export default function SettingsPage() {
  const [deviceIdValue, setDeviceIdValue] = useState(getDeviceId());
  const [editingId, setEditingId] = useState(false);
  const [message, setMessage] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(localStorage.getItem(LAST_SYNC_KEY));
  const fileInputRef = useRef(null);

  async function handleSyncNow() {
    setSyncing(true);
    setMessage('');
    try {
      const result = await syncNow();
      const now = new Date().toISOString();
      localStorage.setItem(LAST_SYNC_KEY, now);
      setLastSync(now);
      setMessage(
        `تمت المزامنة بنجاح — أُرسلت ${result.pushed} مهمة، وتحدّثت ${result.updatedLocally} مهمة محلياً من الخادم.`
      );
    } catch (err) {
      setMessage('فشلت المزامنة: ' + err.message + ' (تأكد من الاتصال بالإنترنت)');
    } finally {
      setSyncing(false);
    }
  }

  function handleSaveDeviceId() {
    const trimmed = deviceIdValue.trim();
    if (!trimmed) {
      setMessage('خطأ: UUID لا يمكن أن يكون فارغاً');
      return;
    }
    setDeviceId(trimmed);
    setEditingId(false);
    setMessage('تم تحديث UUID الجهاز بنجاح.');
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const count = await importData(file);
      setMessage(`تم استيراد ${count} مهمة بنجاح. أعد تحميل الصفحة لرؤية النتيجة كاملة.`);
    } catch (err) {
      setMessage('خطأ أثناء الاستيراد: ' + err.message);
    } finally {
      e.target.value = '';
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px 60px' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, margin: 0 }}>  الإعدادات</h1>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 40, margin: 0 }}>المهام الهرمي </h1>

      <p style={{ color: 'var(--color-ink-soft)', marginTop: 4, marginBottom: 28 }}>
        النسخ الاحتياطي وهوية هذا الجهاز
      </p>

      <SectionCard title="النسخ الاحتياطي">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="primary" onClick={exportData}>تصدير نسخة احتياطية</Button>
          <Button onClick={() => fileInputRef.current?.click()}>استيراد نسخة</Button>
          <input
            type="file"
            accept="application/json"
            ref={fileInputRef}
            onChange={handleImportFile}
            style={{ display: 'none' }}
          />
        </div>
        <p style={{ fontSize: 12, color: 'var(--color-brick)', marginTop: 10 }}>
          تنبيه: الاستيراد يستبدل كل المهام الحالية في هذا الجهاز بمحتوى الملف، ولا يمكن التراجع عن هذه العملية.
        </p>
      </SectionCard>

      <SectionCard
        title="المزامنة مع الخادم"
        subtitle="يدفع مهامك المحلية ويسحب أي تحديثات من أجهزة أخرى بنفس UUID"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Button variant="primary" onClick={handleSyncNow}>
            {syncing ? 'جارِ المزامنة…' : 'مزامنة الآن'}
          </Button>
          {lastSync && (
            <span style={{ fontSize: 12, color: 'var(--color-ink-soft)' }}>
              آخر مزامنة: {new Date(lastSync).toLocaleString('ar')}
            </span>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="هوية الجهاز"
        subtitle="يُستخدم هذا المعرّف لربط مهام هذا الجهاز بجهاز آخر عبر Cloudflare"
      >
        {editingId ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              value={deviceIdValue}
              onChange={(e) => setDeviceIdValue(e.target.value)}
              style={{
                flex: 1,
                minWidth: 240,
                padding: '8px 10px',
                border: '1px solid var(--color-line)',
                borderRadius: 'var(--radius-sm)',
              }}
            />
            <Button variant="primary" onClick={handleSaveDeviceId}>حفظ</Button>
            <Button onClick={() => setEditingId(false)}>إلغاء</Button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <code
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                background: 'var(--color-canvas)',
                padding: '5px 10px',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {deviceIdValue}
            </code>
            <Button onClick={() => setEditingId(true)}>تعديل</Button>
          </div>
        )}
      </SectionCard>

      {message && (
        <p
          style={{
            marginTop: 16,
            padding: 12,
            background: 'var(--color-growth-soft)',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
          }}
        >
          {message}
        </p>
      )}

      {/* Privacy Policy link */}
      <div
        style={{
          marginTop: 32,
          paddingTop: 16,
          borderTop: '1px solid var(--color-line)',
          textAlign: 'center',
          fontSize: 13,
        }}
      >
        <a
          href="/privacy-policy.html"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--color-ink-soft)' }}
        >
          سياسة الخصوصية (Privacy Policy)
        </a>
      </div>
    </div>
  );
}
