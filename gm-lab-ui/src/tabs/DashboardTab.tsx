/* DashboardTab — the GM LAB landing: hero shot, bridge status, module survey
 * (VIN / part-number reads across the GM module list over the J2534 bridge). */
import { useState } from 'react';
import { GM_MODULES, type GmModule } from '@/lib/gm/moduleMap';
import { createBridgeClient, getBridgeConfig, useBridgeStatus, disconnect } from '@/lib/bridgeClient';
import { validateVin, type VinCheck } from '@/lib/gm/vin';
import { HeroShot } from '@/components/HeroShot';
import { VerdictPill } from '@/components/Verdict';

interface SurveyRowState {
  module: GmModule;
  vin?: string;
  vinCheck?: VinCheck;
  status: 'idle' | 'reading' | 'ok' | 'fail' | 'silent';
  error?: string;
}

const DID_VIN_F190 = '22F190';
const DID_PART_F132 = '22F132';

export function DashboardTab() {
  const st = useBridgeStatus();
  const [rows, setRows] = useState<SurveyRowState[]>(GM_MODULES.map((m) => ({ module: m, status: 'idle' })));
  const [busy, setBusy] = useState(false);

  const setRow = (id: string, patch: Partial<SurveyRowState>) =>
    setRows((rs) => rs.map((r) => (r.module.id === id ? { ...r, ...patch } : r)));

  async function surveyModule(row: SurveyRowState): Promise<void> {
    const m = row.module;
    if (m.canReq === undefined || m.canResp === undefined) return;
    setRow(m.id, { status: 'reading' });
    const bridge = createBridgeClient(getBridgeConfig().url);
    try {
      await bridge.connectClassic();
      const vinResp = await bridge.udsExchange(m.canReq, m.canResp, DID_VIN_F190);
      const vin = vinResp.startsWith('62F190') ? hexToAscii(vinResp.slice(6, 6 + 34)) : undefined;
      let vinCheck: VinCheck | undefined;
      if (vin) vinCheck = validateVin(vin);
      setRow(m.id, {
        status: vin ? 'ok' : 'silent',
        vin,
        vinCheck,
        error: vin ? undefined : `no 62 F1 90 (got ${vinResp.slice(0, 24) || 'silence'})`,
      });
    } catch (e) {
      setRow(m.id, { status: 'fail', error: String(e instanceof Error ? e.message : e) });
    }
  }

  async function runSurvey(): Promise<void> {
    setBusy(true);
    for (const row of rows) {
      if (row.module.canReq !== undefined) await surveyModule(row);
    }
    await disconnect(getBridgeConfig().url);
    setBusy(false);
  }

  return (
    <div className="fade-in" data-testid="dashboard-tab">
      <section className="hero">
        <h1>
          GM LAB <span style={{ color: 'var(--blue-400)' }}>— every decoded GM lane, one bench screen.</span>
        </h1>
        <p className="lead">
          The estate&apos;s GM twin of the SRT Lab: security console over every decoded algorithm,
          VIN / mileage / marry capability from the mined applet corpus, SPS emulator lane, and the
          J2534 bridge on :8765. Compute only from real tables — provenance on every key.
        </p>
        <HeroShot />
      </section>

      <div className="glass">
        <h2>
          LIVE VEHICLE BUS{' '}
          <VerdictPill state={st.ok ? 'green' : st.probed ? 'red' : 'gray'}>
            {st.ok ? `BRIDGE OK${st.voltage !== undefined ? ` · ${st.voltage}` : ''}` : st.probed ? 'BRIDGE DOWN' : 'PROBING…'}
          </VerdictPill>
        </h2>
        <p style={{ color: 'var(--white-400)', marginTop: 0 }}>
          Bridge daemon {st.url} — the shared channel law applies: close the SRT Lab app before
          firing anything here. flags:0 is enforced on every raw lane.
        </p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button className="btn" onClick={runSurvey} disabled={busy || !st.ok}>
            {busy ? 'SURVEYING…' : 'RUN MODULE SURVEY'}
          </button>
          <span style={{ color: 'var(--white-400)', fontSize: 'var(--fs-label)' }}>
            reads 22 F1 90 (VIN) per module — 10 03 extended session assumed
          </span>
        </div>
      </div>

      <div className="glass">
        <h2>MODULE SURVEY</h2>
        <table className="data" data-testid="module-survey">
          <thead>
            <tr>
              <th>Module</th>
              <th>Gen</th>
              <th>Tx/Rx</th>
              <th>VIN</th>
              <th>Verdict</th>
              <th>Security family</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.module.id}>
                <td>{r.module.name}</td>
                <td>{r.module.generation}</td>
                <td>{r.module.canReq !== undefined ? `0x${r.module.canReq.toString(16)}/0x${r.module.canResp?.toString(16)}` : 'DoIP'}</td>
                <td className="mono">{r.vin ?? '—'}</td>
                <td>
                  {r.status === 'idle' && <VerdictPill state="gray">IDLE</VerdictPill>}
                  {r.status === 'reading' && <VerdictPill state="blue">READING</VerdictPill>}
                  {r.status === 'ok' && r.vinCheck?.valid && <VerdictPill state="green">VIN OK</VerdictPill>}
                  {r.status === 'ok' && r.vinCheck && !r.vinCheck.valid && <VerdictPill state="amber">VIN INVALID</VerdictPill>}
                  {r.status === 'silent' && <VerdictPill state="amber">SILENT</VerdictPill>}
                  {r.status === 'fail' && <VerdictPill state="red">FAIL</VerdictPill>}
                  {r.error && <div style={{ color: 'var(--white-400)', fontSize: 'var(--fs-micro)' }}>{r.error}</div>}
                </td>
                <td style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-micro)', color: 'var(--white-400)' }}>
                  {r.module.security}
                  {r.module.notes ? ` — ${r.module.notes}` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function hexToAscii(hex: string): string {
  let s = '';
  for (let i = 0; i + 2 <= hex.length; i += 2) {
    const code = parseInt(hex.slice(i, i + 2), 16);
    if (code >= 0x20 && code <= 0x7e) s += String.fromCharCode(code);
  }
  return s;
}
