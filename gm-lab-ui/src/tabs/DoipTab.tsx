/* DoipTab — Global B DoIP lane stub. *** EXPERIMENTAL ***: pure frame
 * builders only (doip.ts), no transport. Renders honest state + the module
 * logical addresses from the module map. */
import { useState } from 'react';
import { buildDoipFrame, buildRoutingActivationRequest, buildDiagnosticMessage, bytesToHexUpper, DOIP_PAYLOAD_TYPES } from '@/lib/gm/doip';
import { GM_MODULES } from '@/lib/gm/moduleMap';
import { VerdictPill } from '@/components/Verdict';

export function DoipTab() {
  const [srcAddr, setSrcAddr] = useState('0x0e80');
  const [target, setTarget] = useState('0x0e28');
  const [uds, setUds] = useState('1003');
  const [out, setOut] = useState<string[]>([]);

  const build = () => {
    const src = Number.parseInt(srcAddr, 16);
    const tgt = Number.parseInt(target, 16);
    const udsBytes = new Uint8Array((uds.replace(/[^0-9a-fA-F]/g, '').match(/../g) ?? []).map((h) => parseInt(h, 16)));
    const frames = [
      ['vehicleIdentificationRequest (0x0001)', buildDoipFrame('vehicleIdentificationRequest', new Uint8Array(0))],
      ['routingActivationRequest (0x0005)', buildDoipFrame('routingActivationRequest', buildRoutingActivationRequest(src))],
      ['diagnosticMessage (0x8001)', buildDoipFrame('diagnosticMessage', buildDiagnosticMessage(tgt, udsBytes))],
    ] as const;
    setOut(frames.map(([label, f]) => `${label}: ${bytesToHexUpper(f)}`));
  };

  return (
    <div className="fade-in" data-testid="doip-tab">
      <div className="glass">
        <h2>
          DOIP — GLOBAL B LANE <VerdictPill state="amber">EXPERIMENTAL — NO TRANSPORT</VerdictPill>
        </h2>
        <p style={{ color: 'var(--white-400)', marginTop: 0 }}>
          ISO 13400-2 frame builders are pure and tested below; the actual DoIP transport (TCP
          13400, vehicle discovery, routing activation handshake) is NOT implemented — this stub
          exists so the Global-B address map has a home and the builders are wire-ready when the
          lane lands.
        </p>
        <div className="grid-3">
          <label className="field">
            <span>Tester source (logical)</span>
            <input type="text" value={srcAddr} onChange={(e) => setSrcAddr(e.target.value)} />
          </label>
          <label className="field">
            <span>Target module (logical)</span>
            <input type="text" value={target} onChange={(e) => setTarget(e.target.value)} />
          </label>
          <label className="field">
            <span>UDS payload</span>
            <input type="text" value={uds} onChange={(e) => setUds(e.target.value)} />
          </label>
        </div>
        <button className="btn" onClick={build}>BUILD FRAMES</button>
        {out.length > 0 && (
          <pre className="logbox" style={{ marginTop: 12 }} data-testid="doip-frames">
            {out.join('\n')}
          </pre>
        )}
      </div>

      <div className="glass">
        <h2>GLOBAL-B LOGICAL ADDRESSES (module map)</h2>
        <table className="data">
          <thead><tr><th>Module</th><th>DoIP logical</th><th>Security family</th></tr></thead>
          <tbody>
            {GM_MODULES.filter((m) => m.doipAddress !== undefined).map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td className="mono">0x{m.doipAddress?.toString(16)}</td>
                <td style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-micro)' }}>{m.security}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ color: 'var(--white-400)', fontSize: 'var(--fs-micro)' }}>
          Payload types wired: {Object.entries(DOIP_PAYLOAD_TYPES).map(([k, v]) => `${k}=0x${v.toString(16).padStart(4, '0')}`).join(', ')}
        </p>
      </div>
    </div>
  );
}
