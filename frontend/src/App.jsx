import { useEffect, useState } from 'react';
import TodayPage from './pages/TodayPage';
import ProjectsPage from './pages/ProjectsPage';
import StatsPage from './pages/StatsPage';
import SettingsPage from './pages/SettingsPage';
import { syncNow } from './sync/syncEngine';

const TABS = [
  { key: 'today', label: 'اليوم' },
  { key: 'projects', label: 'المشاريع' },
  { key: 'stats', label: 'الإحصائيات' },
  { key: 'settings', label: 'الإعدادات' },
];

const PAGES = {
  today: TodayPage,
  projects: ProjectsPage,
  stats: StatsPage,
  settings: SettingsPage,
};

export default function App() {
  const [screen, setScreen] = useState('today');
  const Page = PAGES[screen];

  // مزامنة صامتة عند فتح التطبيق - إذا كنت أوفلاين تفشل بهدوء ولا تعطّل التطبيق
  useEffect(() => {
    syncNow().catch(() => {
      // لا شيء - التطبيق يعمل محلياً بشكل طبيعي حتى لو فشلت المزامنة
    });
  }, []);

  return (
    <div style={{ minHeight: '100vh' }}>
      <nav
        style={{
          display: 'flex',
          gap: 4,
          justifyContent: 'center',
          padding: '14px 12px',
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-line)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          flexWrap: 'wrap',
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setScreen(tab.key)}
            style={{
              padding: '8px 18px',
              borderRadius: 999,
              border: 'none',
              background: screen === tab.key ? 'var(--color-growth-soft)' : 'transparent',
              color: screen === tab.key ? 'var(--color-growth)' : 'var(--color-ink-soft)',
              fontWeight: screen === tab.key ? 600 : 400,
              fontSize: 14,
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <Page />
    </div>
  );
}
