import { useEffect } from 'react';
import ListBrowser from './ListBrowser';

/**
 * لوحة جانبية منزلقة (Drawer) تحتضن ListBrowser بدل عرضه دائماً في أعلى
 * الصفحة. لا تلمس أي منطق داخلي في ListBrowser - فقط تتحكم في الظهور/الإخفاء
 * وتُغلق تلقائياً بعد اختيار قائمة (onNavigate) لتجربة أفضل على الهاتف.
 */
export default function ListDrawer({ open, onClose, currentListId, onNavigate }) {
  // إغلاق بمفتاح Escape - مفيد على الحاسوب
  useEffect(() => {
    if (!open) return undefined;
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  function handleNavigate(listId) {
    onNavigate(listId);
    onClose();
  }

  return (
    <>
      {/* خلفية معتمة تُغلق اللوحة عند الضغط عليها */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(43, 42, 37, 0.35)',
          zIndex: 900,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* اللوحة الجانبية نفسها - تنزلق من اليمين (جهة بداية القراءة في RTL) */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          right: 0,
          width: 'min(320px, 85vw)',
          background: 'var(--color-canvas)',
          borderInlineStart: '1px solid var(--color-line)',
          boxShadow: 'var(--shadow-card)',
          zIndex: 901,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s ease',
          display: 'flex',
          flexDirection: 'column',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            borderBottom: '1px solid var(--color-line)',
            flexShrink: 0,
          }}
        >
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, margin: 0 }}>القوائم</h2>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            style={{
              width: 30,
              height: 30,
              border: 'none',
              background: 'none',
              fontSize: 18,
              color: 'var(--color-ink-soft)',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
          <ListBrowser currentListId={currentListId} onNavigate={handleNavigate} />
        </div>
      </div>
    </>
  );
}