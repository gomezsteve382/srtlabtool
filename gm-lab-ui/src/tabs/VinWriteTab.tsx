/* VinWriteTab — the 2E F1 90 lane with the capability gate. The matrix drives
 * everything; SERVER-FLOW-ONLY / UNMAPPED rows refuse; UNVERIFIED-LIVE rows
 * need an explicit operator GO checkbox. Nothing fires automatically. */
import { useState } from 'react';
import { VIN_WRITE_MATRIX, vinWritePreflight, type VinWriteCapability } from '@/lib/gm/vinWrite';
import { validateVin } from '@/lib/gm/vin';
import { ProvenanceBadge, VerdictPill } from '@/components/Verdict';

const STATE_PILL: Record<VinWriteCapability['writeState'], 'amber' | 'red' | 'gray'> = {
  'UNVERIFIED-LIVE': 'amber',
  'KNOWN-CLOSED': 'red',
  'SERVER-FLOW-ONLY': 'red',
  UNMAPPED: 'gray',
};

export function VinWriteTab() {
  const [vin, setVin] = useState('');
  const [go, setGo] = useState(false);
  const check = vin ? validateVin(vin) : null;

  return (
    <div className="fade-in" data-testid="vinwrite-tab">
      <div className="glass">
        <h2>VIN WRITE — DIALECT-AWARE LANE (capability-gated)</h2>
        <p style={{ color: 'var(--white-400)', marginTop: 0 }}>
          ESTATE STATE: in the applet corpus, GM VIN write does NOT live in the numeric applets —
          it rides the tisvcsv4 + server-side programming flow. The classic 2E lane here is the
          generic UDS shape; every module row is gated by its receipt and nothing auto-fires.
        </p>
        <label className="field">
          <span>Target VIN (17 chars)</span>
          <input type="text" value={vin} onChange={(e) => setVin(e.target.value)} maxLength={17} className="mono" />
        </label>
        {check && (
          <p>
            {check.valid ? (
              <VerdictPill state="green">VIN VALID — check digit OK</VerdictPill>
            ) : (
              <VerdictPill state="red">
                VIN INVALID — length {check.lengthOk ? 'ok' : 'BAD'} · alphabet {check.alphabetOk ? 'ok' : 'BAD'} · check digit{' '}
                {check.checkDigitOk ? 'ok' : 'MISMATCH'}
              </VerdictPill>
            )}
          </p>
        )}
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
          <input type="checkbox" checked={go} onChange={(e) => setGo(e.target.checked)} />
          <span style={{ fontSize: 'var(--fs-label)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            Operator GO — I understand the receipt state of the row I fire
          </span>
        </label>
      </div>

      <div className="glass">
        <h2>PER-MODULE CAPABILITY MATRIX</h2>
        <table className="data" data-testid="vinwrite-matrix">
          <thead>
            <tr><th>Module</th><th>Write state</th><th>Preflight</th><th>Payload</th></tr>
          </thead>
          <tbody>
            {VIN_WRITE_MATRIX.map((cap) => {
              const pf = vinWritePreflight(cap, vin || '1GCUKSEC0JZ123456', { operatorConfirm: go });
              return (
                <tr key={cap.moduleId}>
                  <td>{cap.moduleName}</td>
                  <td><VerdictPill state={STATE_PILL[cap.writeState]}>{cap.writeState}</VerdictPill></td>
                  <td>
                    {pf.go ? <VerdictPill state="green">GO</VerdictPill> : <VerdictPill state="gray">NO-GO</VerdictPill>}
                    {pf.blockers.slice(0, 1).map((b, i) => (
                      <div key={i} style={{ color: 'var(--white-400)', fontSize: 'var(--fs-micro)' }}>{b}</div>
                    ))}
                  </td>
                  <td className="mono" style={{ fontSize: 'var(--fs-micro)' }}>{pf.payloadHex ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {VIN_WRITE_MATRIX.map((cap) => (
          <ProvenanceBadge key={cap.moduleId} prov={{ grade: 'UNVERIFIED HYPOTHESIS', receipts: cap.receipts }} />
        ))}
      </div>
    </div>
  );
}
