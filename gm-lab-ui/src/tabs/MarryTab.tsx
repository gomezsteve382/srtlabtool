/* MarryTab — GM set coherence: the VIN census verdict per module + the honest
 * GM "marry state" panel. Estate truth: the FCA-style SEC16/secret marry does
 * NOT map to GM — Global A security = dllsecurity runtime algo, Global B =
 * IECS/S84 (server input). What IS checkable locally: VIN coherence (census)
 * + per-module security family (module map). Labeled accordingly. */
import { useState } from 'react';
import { GM_MODULES } from '@/lib/gm/moduleMap';
import { runCensus, type CensusEntry, type CensusResult } from '@/lib/gm/census';
import { createBridgeClient, getBridgeConfig, disconnect, useBridgeStatus } from '@/lib/bridgeClient';
import { VerdictPill } from '@/components/Verdict';

export function MarryTab() {
  const st = useBridgeStatus();
  const [result, setResult] = useState<CensusResult | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    const entries: CensusEntry[] = [];
    const bridge = createBridgeClient(getBridgeConfig().url);
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
        entries.push({ moduleId: m.id, moduleName: m.name, vin });
      }
      await disconnect(getBridgeConfig().url);
    } finally {
      setBusy(false);
    }
    setResult(runCensus(entries));
  };

  return (
    <div className="fade-in" data-testid="marry-tab">
      <div className="glass">
        <h2>
          MARRY — SET COHERENCE{' '}
          {result ? (
            result.coherent ? (
              <VerdictPill state="green">COHERENT SET — {result.dominantVin}</VerdictPill>
            ) : (
              <VerdictPill state="red">INCOHERENT / UNREADABLE</VerdictPill>
            )
          ) : (
            <VerdictPill state="gray">NO DATA</VerdictPill>
          )}
        </h2>
        <p style={{ color: 'var(--white-400)', marginTop: 0 }}>
          GM marry law (honest scope): there is NO FCA-style SEC16/immo-secret store to move on GM.
          Global A modules carry runtime-algo dllsecurity; Global B delegates to IECS/S84 with the
          unlock INPUT material server-side. What the bench can verify locally = VIN coherence
          across the set + per-module security family. The census drives the verdict.
        </p>
        <button className="btn" onClick={run} disabled={busy || !st.ok}>
          {busy ? 'READING…' : 'RUN SET CHECK'}
        </button>
      </div>

      <div className="glass">
        <h2>GM MARRY-STATE PANEL (capability, per module)</h2>
        <table className="data" data-testid="marry-panel">
          <thead>
            <tr><th>Module</th><th>Gen</th><th>Security family</th><th>Local coherence lane</th></tr>
          </thead>
          <tbody>
            {GM_MODULES.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{m.generation}</td>
                <td style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-micro)' }}>{m.security}</td>
                <td><VerdictPill state="blue">VIN CENSUS ONLY</VerdictPill></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="prov" data-testid="provenance">
          <span className="grade" style={{ color: 'var(--blue-400)' }}>ESTATE RECEIPTED</span>
          <div>
            GM_COMPLETE MADDOG sweep §W2.1 (security architecture per applet family) ·
            UNLOCK_CHAIN.md §2 (Global-B honest boundary: server-side input material)
          </div>
        </div>
      </div>

      {result && (
        <div className="glass">
          <h2>CENSUS RESULT</h2>
          <table className="data">
            <thead><tr><th>Module</th><th>VIN</th><th>Verdict</th></tr></thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.entry.moduleId}>
                  <td>{r.entry.moduleName}</td>
                  <td className="mono">{r.entry.vin ?? '—'}</td>
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
    </div>
  );
}
