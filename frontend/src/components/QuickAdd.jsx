import { useState } from 'react';

/**
 * إدخال سريع على شكل سطر دفتر: يكتب المستخدم عنوان المهمة ويضغط Enter
 * لإضافتها فوراً - بدل نموذج تقليدي بحقول متعددة.
 */
export default function QuickAdd({ onAdd, placeholder = 'اكتب مهمة جديدة واضغط Enter…', allowType = false }) {
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
      }}
    >
      <span style={{ color: 'var(--color-ink-soft)', fontSize: 18, lineHeight: 1 }}>+</span>

      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 15,
          color: 'var(--color-ink)',
          padding: '4px 0',
        }}
      />

      {allowType && (
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            onClick={() => setType('single')}
            style={{
              fontSize: 12,
              padding: '3px 10px',
              borderRadius: 999,
              border: type === 'single' ? '1px solid var(--color-growth)' : '1px solid var(--color-line)',
              background: type === 'single' ? 'var(--color-growth-soft)' : 'transparent',
              color: 'var(--color-ink)',
            }}
          >
            مهمة
          </button>
          <button
            type="button"
            onClick={() => setType('composite')}
            style={{
              fontSize: 12,
              padding: '3px 10px',
              borderRadius: 999,
              border: type === 'composite' ? '1px solid var(--color-growth)' : '1px solid var(--color-line)',
              background: type === 'composite' ? 'var(--color-growth-soft)' : 'transparent',
              color: 'var(--color-ink)',
            }}
          >
            مشروع
          </button>
        </div>
      )}
    </div>
  );
}
