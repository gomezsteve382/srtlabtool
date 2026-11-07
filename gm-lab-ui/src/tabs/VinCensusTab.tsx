/* VinCensusTab — multi-module VIN read/compare (the twin's VIN census shape):
 * run the survey, render per-module verdicts + the set coherence verdict. */
import { useState } from 'react';
import { GM_MODULES } from '@/lib/gm/moduleMap';
import { runCensus, type CensusEntry, type CensusResult } from '@/lib/gm/census';
import { createBridgeClient, getBridgeConfig, disconnect, useBridgeStatus } from '@/lib/bridgeClient';
import { VerdictPill } from '@/components/Verdict';

export function VinCensusTab() {
  const st = useBridgeStatus();
  const [result, setResult] = useState<CensusResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const run = async () => {
    setBusy(true);
    setLog([]);
    const entries: CensusEntry[] = [];
    const bridge = createBridgeClient(getBridgeConfig().url);
    const lines: string[] = [];
    try {
      await bridge.connectClassic();
      for (const m of GM_MODULES) {
        if (m.canReq === undefined) continue;
        const resp = await bridge.udsExchange(m.canReq, m.canResp ?? 0, '22F190');
        const hex = resp.toUpperCase();
        let vin: string | null = null;
        if (hex.startsWith('62F190')) {
          let s = '';
          const ascii = hex.slice(6, 40);
          for (let i = 0; i + 2 <= ascii.length; i += 2) {
            const code = parseInt(ascii.slice(i, i + 2), 16);
            if (code < 0x20 || code > 0x7e) break;
            s += String.fromCharCode(code);
          }
          vin = s.length >= 17 ? s.slice(0, 17) : null;
        }
        lines.push(`${m.name}: ${resp ? `RX ${hex.slice(0, 44)}` : '(silence)'}${vin ? ` → VIN ${vin}` : ''}`);
        entries.push({ moduleId: m.id, moduleName: m.name, vin });
      }
      await disconnect(getBridgeConfig().url);
    } catch (e) {
      lines.push(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
    }
    setLog(lines);
    setResult(runCensus(entries));
    setBusy(false);
  };

  return (
    <div className="fade-in" data-testid="vincensus-tab">
      <div className="glass">
        <h2>
          VIN CENSUS{' '}
          <VerdictPill state={st.ok ? 'green' : 'gray'}>{st.ok ? 'BRIDGE OK' : 'BRIDGE DOWN'}</VerdictPill>
        </h2>
        <p style={{ color: 'var(--white-400)', marginTop: 0 }}>
          Reads 22 F1 90 (VIN) across every CAN-reachable GM module on the bridge and renders the
          agreement verdict. Coherent = ≥2 readable modules agree AND nothing disagrees.
        </p>
        <button className="btn" onClick={run} disabled={busy || !st.ok}>
          {busy ? 'READING…' : 'RUN CENSUS'}
        </button>
      </div>

      {result && (
        <div className="glass">
          <h2>
            VERDICT{' '}
            {result.rows.every((r) => r.verdict === 'UNREAD') ? (
              <VerdictPill state="amber">NOTHING READABLE</VerdictPill>
            ) : result.coherent ? (
              <VerdictPill state="green">SET COHERENT — {result.dominantVin}</VerdictPill>
            ) : (
              <VerdictPill state="red">INCOHERENT SET</VerdictPill>
            )}
          </h2>
          <table className="data" data-testid="census-rows">
            <thead>
              <tr><th>Module</th><th>VIN</th><th>Check digit</th><th>Verdict</th></tr>
            </thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.entry.moduleId}>
                  <td>{r.entry.moduleName}</td>
                  <td className="mono">{r.entry.vin ?? '—'}</td>
                  <td>{r.check ? (r.check.checkDigitOk ? 'valid' : 'INVALID') : '—'}</td>
                  <td>
                    {r.verdict === 'MATCH' && <VerdictPill state="green">MATCH</VerdictPill>}
                    {r.verdict === 'MISMATCH' && <VerdictPill state="red">MISMATCH</VerdictPill>}
                    {r.verdict === 'UNREAD' && <VerdictPill state="gray">UNREAD</VerdictPill>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {log.length > 0 && (
        <div className="glass">
          <h2>RAW EXCHANGE</h2>
          <div className="logbox">{log.join('\n')}</div>
        </div>
      )}
    </div>
  );
}
