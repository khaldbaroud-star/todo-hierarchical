/**
 * حلقة نمو (Growth Ring) - العنصر البصري المميز للتطبيق.
 * تمثّل تقدم مهمة مركّبة كحلقة شجرة: تمتلئ تدريجياً باللون الأخضر
 * بمقدار النسبة المئوية المكتملة من أوراقها (leaf tasks).
 */
export default function ProgressRing({ percent = 0, size = 32, strokeWidth = 3.5 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);
  const isComplete = percent >= 100;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-line)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={isComplete ? 'var(--color-growth)' : 'var(--color-amber)'}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--font-mono)"
        fontSize={size * 0.3}
        fill="var(--color-ink)"
      >
        {percent}
      </text>
    </svg>
  );
}
