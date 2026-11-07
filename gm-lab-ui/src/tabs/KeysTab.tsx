/* KeysTab — GM key programming + PIN stack.
 * Three panels: ① KEY LEARN (ceremony player, per capability-matrix row),
 * ② PIN/key BRUTE-FORCE runner (last-resort lane, banked Custom-ECM law,
 * GO-gated), ③ THE LAW (banked receipts this tab is built on).
 * Every fire lane is operator-GO gated and honestly graded UNVERIFIED-LIVE
 * until a real wire pair lands. No key fabrication anywhere. */

import { useMemo, useRef, useState } from 'react';
import {
  createBridgeClient,
  getBridgeConfig,
  useBridgeStatus,
  disconnect,
} from '@/lib/bridgeClient';
import {
  addKeyPlan,
  recycleCeremony,
  buildBruteForcePlan,
  runBruteForce,
  candidateHex,
  type AttemptVerdict,
  type KeyLearnStep,
} from '@/lib/gm/keyLearn';
import { VerdictPill } from '@/components/Verdict';

interface LogLine {
  t: string;
  text: string;
  cls: string;
}

const now = () => new Date().toLocaleTimeString('en-US', { hour12: false });
const log = (text: string, cls = 'text-slate-300'): LogLine => ({ t: now(), text, cls });

const CEREMONY_ROWS = [
  { id: 'bcm-odo-ga', label: 'BCM odometer / recycle (Global A 2018-19, BcmOdoList)', txId: 0x7e2, rxId: 0x7ea },
  { id: 'ipc-t1xx', label: 'IPC cluster (MY20 T1XX, IpcDelphiList — algo 0xF0BC)', txId: 0x7e3, rxId: 0x7eb },
  { id: 'ecm-k2xx', label: 'ECM (K2XX "460" — algo 0x00DF)', txId: 0x7e0, rxId: 0x7e8 },
];

export function KeysTab() {
  const st = useBridgeStatus();
  const bridgeUp = st.ok === true;

  /* ceremony player state */
  const [rowId, setRowId] = useState(CEREMONY_ROWS[0].id);
  const row = useMemo(() => CEREMONY_ROWS.find((r) => r.id === rowId) ?? CEREMONY_ROWS[0], [rowId]);
  const [cerLog, setCerLog] = useState<LogLine[]>([]);
  const [cerBusy, setCerBusy] = useState(false);
  const [goCer, setGoCer] = useState(false);

  /* brute state */
  const [bfStart, setBfStart] = useState('0000');
  const [bfEnd, setBfEnd] = useState('FFFF');
  const [bfLog, setBfLog] = useState<LogLine[]>([]);
  const [bfBusy, setBfBusy] = useState(false);
  const [goBf, setGoBf] = useState(false);
  const [bfHit, setBfHit] = useState<string | null>(null);
  const stopRef = useRef(false);

  const push = (set: typeof setCerLog) => (line: LogLine) => set((prev) => [...prev.slice(-199), line]);

  async function runCeremony() {
    if (!bridgeUp || cerBusy) return;
    setCerBusy(true);
    setCerLog([]);
    const client = createBridgeClient(getBridgeConfig().url);
    const add = push(setCerLog);
    try {
      add(log(`KEY LEARN — ${row.label} · tx ${hex4(row.txId)} rx ${hex4(row.rxId)}`, 'text-blue-300'));
      const plan: KeyLearnStep[] = [...addKeyPlan({ id: row.id, txId: row.txId, rxId: row.rxId })];
      for (const step of plan) {
        if (step.holdMs && step.holdMs > 2000) {
          add(log(`HOLD  ${step.label} — operator step, skipped in auto-run`, 'text-amber-300'));
          continue;
        }
        if (!step.payload) {
          add(log(`SKIP  ${step.label}`, 'text-slate-500'));
          continue;
        }
        add(log(`SEND  ${step.label}: ${step.payload}`));
        const resp = await client.udsExchange(row.txId, row.rxId, step.payload).catch((e) => `ERROR ${String(e)}`);
        add(log(`RECV  ${resp}`, resp.startsWith('7F') ? 'text-red-300' : 'text-emerald-300'));
      }
      add(log('ADD-KEY auto-run complete — learn-routine step is UNVERIFIED-LIVE until the matrix row is walked.', 'text-amber-300'));
    } catch (e) {
      add(log(`ERROR ${String(e)}`, 'text-red-400'));
    } finally {
      setCerBusy(false);
    }
  }

  async function runCeremonyRecycle() {
    if (!bridgeUp || cerBusy) return;
    setCerBusy(true);
    setCerLog([]);
    const add = push(setCerLog);
    add(log('RECYCLE CEREMONY — the banked EXECUTED-LIVE-HW sequence. Holds are operator-timed.', 'text-blue-300'));
    for (const step of recycleCeremony()) {
      add(log(`${step.holdMs ? 'HOLD ' : 'STEP '} ${step.label}`, step.holdMs ? 'text-amber-300' : 'text-slate-300'));
      if (step.holdMs && step.holdMs > 0) {
        add(log(`      hold ${Math.round(step.holdMs / 1000)}s — run this step on the bench clock`, 'text-slate-500'));
      }
    }
    add(log('Wire payloads are per-module (3B 90-class GMLAN / 2E UDS) — matrix rows supply exact DIDs.', 'text-slate-500'));
    setCerBusy(false);
  }

  async function runBrute() {
    if (!bridgeUp || bfBusy) return;
    setBfBusy(true);
    setBfHit(null);
    setBfLog([]);
    stopRef.current = false;
    const client = createBridgeClient(getBridgeConfig().url);
    const add = push(setBfLog);
    try {
      const plan = buildBruteForcePlan({
        start: parseInt(bfStart, 16),
        end: parseInt(bfEnd, 16) + 1,
      });
      add(log(`BRUTE 27 02 candidates ${candidateHex(plan.start)} … ${candidateHex(plan.end - 1)} · delay law armed`, 'text-blue-300'));
      const hit = await runBruteForce(client, plan, row.txId, row.rxId, {
        onAttempt: (k, resp, v: AttemptVerdict, n) => {
          if (n % 25 === 0 || v.kind !== 'nrc-other') {
            add(log(`#${n} ${candidateHex(k)} → ${resp || '(empty)'} [${v.kind}]`, v.kind === 'positive' ? 'text-emerald-300' : v.kind === 'empty' ? 'text-slate-500' : 'text-slate-400'));
          }
        },
        shouldStop: () => stopRef.current,
        sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      });
      if (hit !== null) {
        setBfHit(candidateHex(hit));
        add(log(`HIT  ${candidateHex(hit)} — module accepted. VERIFY before trusting (UNVERIFIED-LIVE).`, 'text-emerald-300'));
      } else {
        add(log('EXHAUSTED or stopped — no positive in range.', 'text-amber-300'));
      }
    } catch (e) {
      add(log(`ERROR ${String(e)}`, 'text-red-400'));
    } finally {
      setBfBusy(false);
    }
  }

  return (
    <div className="keys-stack fade-in">
      <section className="glass">
        <div className="keys-head">
          <h2>KEY LEARN — CEREMONY PLAYER</h2>
          <VerdictPill state="amber">UNVERIFIED-LIVE</VerdictPill>
          <VerdictPill state={bridgeUp ? 'green' : 'gray'}>
            {bridgeUp ? 'BRIDGE OK' : 'BRIDGE DOWN'}
          </VerdictPill>
        </div>

        <div className="keys-toolbar">
          <select value={rowId} onChange={(e) => setRowId(e.target.value)}>
            {CEREMONY_ROWS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>

          <label className="keys-go">
            <input type="checkbox" checked={goCer} onChange={(e) => setGoCer(e.target.checked)} />
            OPERATOR GO
          </label>

          <button className="btn" disabled={!bridgeUp || !goCer || cerBusy} onClick={runCeremony}>
            {cerBusy ? 'RUNNING…' : 'RUN ADD-KEY AUTO'}
          </button>

          <button className="btn ghost" disabled={cerBusy} onClick={runCeremonyRecycle}>
            DRY-RUN RECYCLE
          </button>
        </div>

        <LogBox lines={cerLog} />
      </section>

      <section className="glass">
        <div className="keys-head">
          <h2>BRUTE FORCE — LAST-RESORT LANE</h2>
          <VerdictPill state="blue">CUSTOM-ECM LAW · IN-HOUSE</VerdictPill>
        </div>

        <p className="keys-copy">
          The banked Custom-ECM architecture: live seed → candidate key → 27 send →
          check → respect the delay law → repeat. Use only when no decoded algorithm
          covers the module&apos;s gate. Covered modules should use SECURITY CONSOLE.
        </p>

        <div className="keys-range">
          <label>
            FROM
            <input type="text" value={bfStart} onChange={(e) => setBfStart(e.target.value)} />
          </label>

          <label>
            TO
            <input type="text" value={bfEnd} onChange={(e) => setBfEnd(e.target.value)} />
          </label>

          <label className="keys-go">
            <input type="checkbox" checked={goBf} onChange={(e) => setGoBf(e.target.checked)} />
            OPERATOR GO
          </label>

          <button className="btn" disabled={!bridgeUp || !goBf || bfBusy} onClick={runBrute}>
            {bfBusy ? 'RUNNING…' : 'START'}
          </button>

          <button
            className="btn danger"
            disabled={!bfBusy}
            onClick={() => {
              stopRef.current = true;
            }}
          >
            STOP
          </button>

          {bfHit && <VerdictPill state="green">{`HIT ${bfHit}`}</VerdictPill>}
        </div>

        <LogBox lines={bfLog} />
      </section>

      <section className="glass">
        <div className="keys-head">
          <h2>THE LAW — RECEIPTS THIS TAB IS BUILT ON</h2>
        </div>

        <ul className="keys-law">
          <li>
            <strong>Custom-ECM architecture:</strong> live seed → candidate →
            security send → verdict → delay handling → repeat.
          </li>
          <li>
            <strong>SKA2 / SSA immobilizer tier:</strong>{' '}
            <code>dllsecurity!SetSeedAndGetKey</code> remains the local security
            calculation layer; entitlement-backed material stays outside this UI.
          </li>
          <li>
            <strong>Recycle ceremony:</strong> operator-timed module preparation
            sequence with explicit hold steps and verification.
          </li>
          <li>
            <strong>PIN oracle:</strong> decode-and-match workflow remains isolated
            to the PIN workspace.
          </li>
          <li>
            <strong>GMLAN dialect:</strong> legacy GM service shapes remain distinct
            from the newer UDS lanes.
          </li>
        </ul>
      </section>
    </div>
  );
}

/* ─── shared bits ─── */

const hex4 = (n: number) => '0x' + n.toString(16).toUpperCase().padStart(3, '0');

function LogBox({ lines }: { lines: LogLine[] }) {
  if (!lines.length) {
    return (
      <div className="logbox keys-log">
        no output — GO gate + bridge required
      </div>
    );
  }

  return (
    <div className="logbox keys-log">
      {lines.map((l, i) => (
        <div key={i} className={l.cls}>
          <span className="text-slate-600">{l.t} </span>
          {l.text}
        </div>
      ))}
    </div>
  );
}
