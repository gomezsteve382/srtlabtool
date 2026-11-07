/* App.tsx — the workspace shell: rail (tab registry) + routed content.
 * Cloned architecture from the srt-lab twin; GM branding; deep-link support
 * via ?tab=<id>. */
import { useMemo, useState } from 'react';
import { WORKSPACE_TABS, isKnownTab, TAB_REDIRECTS } from '@/lib/workspaceTabs';
import { tabIcon } from '@/components/tabIcons';
import { useBridgeStatus } from '@/lib/bridgeClient';
import { DashboardTab } from '@/tabs/DashboardTab';
import { SecurityConsoleTab } from '@/tabs/SecurityConsoleTab';
import { PlaceholderTab } from '@/tabs/PlaceholderTab';
import { VinCensusTab } from '@/tabs/VinCensusTab';
import { VinWriteTab } from '@/tabs/VinWriteTab';
import { MileageTab } from '@/tabs/MileageTab';
import { MarryTab } from '@/tabs/MarryTab';
import { PinTab } from '@/tabs/PinTab';
import { KeysTab } from '@/tabs/KeysTab';
import { AppletViewerTab } from '@/tabs/AppletViewerTab';
import { EmulatorTab } from '@/tabs/EmulatorTab';
import { SessionAnalyzerTab } from '@/tabs/SessionAnalyzerTab';
import { DoipTab } from '@/tabs/DoipTab';

function initialTab(): string {
  try {
    const q = new URLSearchParams(globalThis.location?.search || '').get('tab');
    if (q && isKnownTab(q)) return q;
  } catch {
    /* non-browser env — default below */
  }
  return 'dashboard';
}

export default function App() {
  const [tab, setTab] = useState<string>(initialTab);
  const st = useBridgeStatus();

  const content = useMemo(() => {
    switch (tab) {
      case 'dashboard':
        return <DashboardTab />;
      case 'security':
        return <SecurityConsoleTab />;
      case 'vincensus':
        return <VinCensusTab />;
      case 'vinwrite':
        return <VinWriteTab />;
      case 'mileage':
        return <MileageTab />;
      case 'marry':
        return <MarryTab />;
      case 'pin':
        return <PinTab />;
      case 'keys':
        return <KeysTab />;
      case 'applets':
        return <AppletViewerTab />;
      case 'emulator':
        return <EmulatorTab />;
      case 'analyzer':
        return <SessionAnalyzerTab />;
      case 'doip':
        return <DoipTab />;
      default:
        return <DashboardTab />;
    }
  }, [tab]);

  return (
    <div className="app-shell">
      <nav className="rail">
        <div className="wordmark">
          <span className="gm-tile">G</span>
          <span>
            <span className="gm-part">GM</span> <span className="lab-part">LAB</span>
          </span>
        </div>
        <div className="rail-sub">estate twin · srt-lab architecture</div>
        <div className="rail-nav">
          {WORKSPACE_TABS.map((t) => {
            const Icon = tabIcon(t.id);
            return (
              <button
                key={t.id}
                className={`rail-btn${tab === t.id ? ' active' : ''}`}
                onClick={() => setTab(t.id)}
                title={t.s}
                data-testid={`rail-${t.id}`}
              >
                <Icon size={14} strokeWidth={2} />
                <span>{t.l}</span>
                {t.experimental && <span className="exp-tag">EXP</span>}
              </button>
            );
          })}
        </div>
        <div className="rail-foot">
          <span className={st.ok ? 'dot' : 'dot off'}>●</span> bridge {st.url.replace(/^https?:\/\//, '')}{' '}
          {st.ok ? '· up' : st.probed ? '· down' : '· probing'}
          <div style={{ marginTop: 4 }}>GM LAB v0.1 · compute only from real tables</div>
        </div>
      </nav>
      <main className="content">{content}</main>
    </div>
  );
}

export { TAB_REDIRECTS };
