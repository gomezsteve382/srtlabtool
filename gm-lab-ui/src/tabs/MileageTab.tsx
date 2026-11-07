/* MileageTab — the BcmOdoList ceremony UI. The capability matrix supplies the
 * rows; the plan builder (lib/gm/mileage.ts) produces the per-step verdicts;
 * writes are operator-GO gated with the UNVERIFIED-LIVE payload flag. */
import { useState } from 'react';
import { CAPABILITY_MATRIX } from '@/lib/gm/capabilityMatrix';
import { buildCeremonyPlan, ODO_SA_LADDER, type ModuleOdoReads } from '@/lib/gm/mileage';
import { createBridgeClient, getBridgeConfig, useBridgeStatus, disconnect } from '@/lib/bridgeClient';
import { ProvenanceBadge, VerdictPill } from '@/components/Verdict';

const STEP_PILL = { PASS: 'green', FAIL: 'red', BLOCKED: 'gray', PENDING: 'blue' } as const;

export function MileageTab() {
  const st = useBridgeStatus();
  const [vehicleVin, setVehicleVin] = useState('');
  const [target, setTarget] = useState('100000');
  const [go, setGo] = useState(false);
  const [reads, setReads] = useState<ModuleOdoReads | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const bcmRow = CAPABILITY_MATRIX.find((r) => r.id === 'bcm-odo-globala');

  const read = async () => {
    setBusy(true);
    setErr(null);
    const bridge = createBridgeClient(getBridgeConfig().url);
    try {
      await bridge.connectClassic();
      // BCM Global A shape (0x7E2/0x7EA). The ceremony: 0x0090 → 0x824B → 0x00DF.
      const vinHex = await bridge.udsExchange(0x7e2, 0x7ea, '220090');
      const preHex = await bridge.udsExchange(0x7e2, 0x7ea, '22824B');
      const odoHex = await bridge.udsExchange(0x7e2, 0x7ea, '2200DF');
      const parseAscii = (h: string, tag: string): string | null => {
        const u = h.toUpperCase();
        if (!u.startsWith(tag)) return null;
        let s = '';
        const ascii = u.slice(tag.length, tag.length + 34);
        for (let i = 0; i + 2 <= ascii.length; i += 2) {
          const code = parseInt(ascii.slice(i, i + 2), 16);
          if (code < 0x20 || code > 0x7e) break;
          s += String.fromCharCode(code);
        }
        return s || null;
      };
      const parseData = (h: string, tag: string): number[] | null => {
        const u = h.toUpperCase();
        if (!u.startsWith(tag)) return null;
        const rest = u.slice(tag.length);
        const out: number[] = [];
        for (let i = 0; i + 2 <= rest.length; i += 2) out.push(parseInt(rest.slice(i, i + 2), 16));
        return out.length ? out : null;
      };
      const moduleVin = parseAscii(vinHex, '620090');
      const preData = parseData(preHex, '62824B');
      const odoData = parseData(odoHex, '6200DF');
      setReads({
        moduleVin,
        preconditionByte: preData && preData.length >= 1 ? preData[0] : null,
        odoRecord: odoData && odoData.length >= 5 ? odoData.slice(0, 5) : null,
      });
      await disconnect(getBridgeConfig().url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const plan = reads
    ? buildCeremonyPlan(reads, vehicleVin || '00000000000000000', Number(target) || 0, { operatorGo: go })
    : null;

  return (
    <div className="fade-in" data-testid="mileage-tab">
      <div className="glass">
        <h2>
          MILEAGE — BCM ODOMETER (BcmOdoList ceremony){' '}
          <VerdictPill state={st.ok ? 'green' : 'gray'}>{st.ok ? 'BRIDGE OK' : 'BRIDGE DOWN'}</VerdictPill>
        </h2>
        <p style={{ color: 'var(--white-400)', marginTop: 0 }}>
          Ceremony fully decoded from the BcmOdoList applets (Global A 2018-19 trucks/SUVs) —
          UNVERIFIED-LIVE until an Escalade/Silverado wire pair lands. Read-modify-verify flow
          below; the 12-B write payload layout is MEDIUM confidence.
        </p>
        <div className="grid-3">
          <label className="field">
            <span>Vehicle VIN (gate reference)</span>
            <input type="text" value={vehicleVin} onChange={(e) => setVehicleVin(e.target.value)} maxLength={17} className="mono" />
          </label>
          <label className="field">
            <span>Target odometer (miles)</span>
            <input type="text" value={target} onChange={(e) => setTarget(e.target.value)} />
          </label>
          <label className="field" style={{ display: 'flex', alignItems: 'end' }}>
            <span style={{ marginBottom: 0 }}>&nbsp;</span>
            <button className="btn" onClick={read} disabled={busy || !st.ok}>
              {busy ? 'READING…' : 'READ MODULE (0x0090 / 0x824B / 0x00DF)'}
            </button>
          </label>
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={go} onChange={(e) => setGo(e.target.checked)} />
          <span style={{ fontSize: 'var(--fs-label)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            Operator GO for the write step (diff the 12-B payload vs a capture first)
          </span>
        </label>
        {err && <p style={{ color: 'var(--red-400)' }}>{err}</p>}
        {reads && (
          <dl className="kv" style={{ marginTop: 12 }}>
            <dt>Module VIN</dt><dd>{reads.moduleVin ?? '— (silent)'}</dd>
            <dt>Precondition</dt><dd>{reads.preconditionByte === null ? '—' : `0x${reads.preconditionByte.toString(16)} (bit0=${reads.preconditionByte & 1})`}</dd>
            <dt>Odo record</dt><dd>{reads.odoRecord ? [...reads.odoRecord].map((b) => b.toString(16).padStart(2, '0')).join(' ') : '—'}</dd>
          </dl>
        )}
      </div>

      {plan && (
        <div className="glass">
          <h2>
            CEREMONY PLAN{' '}
            {plan.steps.find((s) => s.status === 'FAIL') ? (
              <VerdictPill state="red">GATE FAIL</VerdictPill>
            ) : plan.canProceedToWrite ? (
              <VerdictPill state="green">ARMED (operator GO)</VerdictPill>
            ) : (
              <VerdictPill state="gray">GATED</VerdictPill>
            )}
          </h2>
          <table className="data" data-testid="ceremony-steps">
            <thead>
              <tr><th>Step</th><th>Request</th><th>Status</th><th>Detail</th></tr>
            </thead>
            <tbody>
              {plan.steps.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-mono)' }}>{s.label}</td>
                  <td className="mono" style={{ fontSize: 'var(--fs-micro)', maxWidth: 320, wordBreak: 'break-all' }}>{s.request}</td>
                  <td><VerdictPill state={STEP_PILL[s.status]}>{s.status}</VerdictPill></td>
                  <td style={{ color: 'var(--white-300)' }}>{s.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {plan.blockers.length > 0 && (
            <ul style={{ color: 'var(--amber-400)', fontSize: 'var(--fs-mono)' }}>
              {plan.blockers.map((b, i) => <li key={i}>{b}</li>)}
            </ul>
          )}
          <p style={{ color: 'var(--white-400)', fontSize: 'var(--fs-micro)' }}>{ODO_SA_LADDER.join(' · ')}</p>
        </div>
      )}

      {bcmRow && (
        <div className="glass">
          <h2>CAPABILITY MATRIX ROW <VerdictPill state="amber">{bcmRow.live}</VerdictPill></h2>
          <dl className="kv">
            <dt>Mileage read</dt><dd>{bcmRow.mileageRead}</dd>
            <dt>Mileage write</dt><dd>{bcmRow.mileageWrite}</dd>
            <dt>VIN</dt><dd>{bcmRow.vin}</dd>
          </dl>
          <ProvenanceBadge prov={bcmRow.provenance} />
        </div>
      )}
    </div>
  );
}
