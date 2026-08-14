import { useState } from 'react';

/**
 * إدخال سريع على شكل سطر دفتر: يكتب المستخدم عنوان المهمة ويضغط Enter
 * لإضافتها فوراً - بدل نموذج تقليدي بحقول متعددة.
 */
export default function QuickAdd({
  onAdd,
  placeholder = 'اكتب مهمة جديدة واضغط Enter…',
  allowType = false,
}) {
  const [text, setText] = useState('');
  const [type, setType] = useState('single');

  function handleKeyDown(e) {
    if (e.key === 'Enter' && text.trim()) {
      onAdd({ title: text.trim(), type });
      setText('');
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 4px',
        borderBottom: '1px solid var(--color-line)',
        minWidth: 0,
        width: '100%',
        boxSizing: 'border-box',
        flexWrap: 'wrap',
      }}
    >
      <span
        style={{
          color: 'var(--color-ink-soft)',
          fontSize: 18,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        +
      </span>

      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={{
          flex: '1 1 140px',
          minWidth: 0,
          width: '100%',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 'clamp(13px, 3.5vw, 15px)',
          color: 'var(--color-ink)',
          padding: '4px 0',
          boxSizing: 'border-box',
        }}
      />

      {allowType && (
        <div
          style={{
            display: 'flex',
            gap: 4,
            flexShrink: 0,
            flexWrap: 'wrap',
            maxWidth: '100%',
          }}
        >
          <button
            type="button"
            onClick={() => setType('single')}
            style={{
              fontSize: 'clamp(11px, 3vw, 12px)',
              padding: '3px 10px',
              borderRadius: 999,
              border:
                type === 'single'
                  ? '1px solid var(--color-growth)'
                  : '1px solid var(--color-line)',
              background:
                type === 'single'
                  ? 'var(--color-growth-soft)'
                  : 'transparent',
              color: 'var(--color-ink)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            مهمة
          </button>

          <button
            type="button"
            onClick={() => setType('composite')}
            style={{
              fontSize: 'clamp(11px, 3vw, 12px)',
              padding: '3px 10px',
              borderRadius: 999,
              border:
                type === 'composite'
                  ? '1px solid var(--color-growth)'
                  : '1px solid var(--color-line)',
              background:
                type === 'composite'
                  ? 'var(--color-growth-soft)'
                  : 'transparent',
              color: 'var(--color-ink)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            مشروع
          </button>
        </div>
      )}
    </div>
  );
}