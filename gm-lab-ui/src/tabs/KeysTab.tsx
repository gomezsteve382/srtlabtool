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
    <div className="space-y-5">
      {/* ─── KEY LEARN ─── */}
      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-bold tracking-widest text-blue-300">KEY LEARN — CEREMONY PLAYER</h2>
          <VerdictPill state="amber">UNVERIFIED-LIVE</VerdictPill>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200"
            value={rowId}
            onChange={(e) => setRowId(e.target.value)}
          >
            {CEREMONY_ROWS.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-400">
            <input type="checkbox" checked={goCer} onChange={(e) => setGoCer(e.target.checked)} />
            OPERATOR GO (wire fires)
          </label>
          <button
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            disabled={!bridgeUp || !goCer || cerBusy}
            onClick={runCeremony}
          >
            RUN ADD-KEY AUTO
          </button>
          <button
            className="rounded border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300 disabled:opacity-40"
            disabled={cerBusy}
            onClick={runCeremonyRecycle}
          >
            DRY-RUN RECYCLE CEREMONY
          </button>
        </div>
        <LogBox lines={cerLog} />
      </section>

      {/* ─── BRUTE FORCE ─── */}
      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-bold tracking-widest text-blue-300">BRUTE FORCE — LAST-RESORT LANE</h2>
          <VerdictPill state="blue">CUSTOM-ECM LAW · IN-HOUSE</VerdictPill>
        </div>
        <p className="mb-3 text-xs leading-relaxed text-slate-500">
          The banked Custom-ECM architecture: live seed → candidate key → 27 send → check → respect the delay law → repeat.
          Use only when NO decoded algo covers the module's gate — for covered modules the SECURITY CONSOLE computes the key
          directly. Range is bounded to the full 16-bit space; delay law is non-negotiable.
        </p>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
          <label>FROM <input className="w-16 rounded border border-slate-700 bg-slate-900 px-2 py-1" value={bfStart} onChange={(e) => setBfStart(e.target.value)} /></label>
          <label>TO <input className="w-16 rounded border border-slate-700 bg-slate-900 px-2 py-1" value={bfEnd} onChange={(e) => setBfEnd(e.target.value)} /></label>
          <label className="flex items-center gap-1.5 text-slate-400">
            <input type="checkbox" checked={goBf} onChange={(e) => setGoBf(e.target.checked)} />
            OPERATOR GO
          </label>
          <button
            className="rounded bg-blue-600 px-3 py-1.5 font-semibold text-white disabled:opacity-40"
            disabled={!bridgeUp || !goBf || bfBusy}
            onClick={runBrute}
          >
            START
          </button>
          <button
            className="rounded border border-red-700 px-3 py-1.5 font-semibold text-red-300 disabled:opacity-40"
            disabled={!bfBusy}
            onClick={() => { stopRef.current = true; }}
          >
            STOP
          </button>
          {bfHit && <VerdictPill state="green">{`HIT ${bfHit}`}</VerdictPill>}
        </div>
        <LogBox lines={bfLog} />
      </section>

      {/* ─── THE LAW ─── */}
      <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <h2 className="mb-3 text-sm font-bold tracking-widest text-blue-300">THE LAW — RECEIPTS THIS TAB IS BUILT ON</h2>
        <ul className="space-y-2 text-xs leading-relaxed text-slate-400">
          <li>· <b className="text-slate-200">Custom-ECM architecture</b> (decompiled GMPINFinder): live seed → candidate → 27 send → check → respect delay-NRC → report → repeat. In-house replication = sequential enumeration; our decoded algos replace the candidate loop for covered modules.</li>
          <li>· <b className="text-slate-200">SKA2/SSA immobilizer tier</b>: tech2.dll + sasbridge.dll + scan100.dll all import <code className="text-blue-300">dllsecurity!SetSeedAndGetKey</code> — the triple-cracked engine. Immobilizer local key step is ours; per-VIN codes ride GM's server (entitlement).</li>
          <li>· <b className="text-slate-200">Recycle ceremony</b>: EXECUTED-LIVE-HW Sept (junkyard module, PIN=0000): virginize → 11-min → clear DTCs → clear VIN → clear prog date → clear PIN → 30-sec ignition-off → re-admit.</li>
          <li>· <b className="text-slate-200">PIN oracle</b>: 2^20 IM608 table, decode-and-match only (K_RULING) — PIN tab.</li>
          <li>· <b className="text-slate-200">GMLAN dialect</b>: RDBI 0x1A / WDBI 0x3B / SA 0x27 — not ISO 22/2E (tisvcsv4 Wave-3).</li>
        </ul>
      </section>
    </div>
  );
}

/* ─── shared bits ─── */

const hex4 = (n: number) => '0x' + n.toString(16).toUpperCase().padStart(3, '0');

function LogBox({ lines }: { lines: LogLine[] }) {
  if (!lines.length) {
    return <div className="rounded-lg border border-slate-800 bg-black/60 p-3 font-mono text-xs text-slate-600">no output — GO gate + bridge required</div>;
  }
  return (
    <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-800 bg-black/60 p-3 font-mono text-xs leading-relaxed">
      {lines.map((l, i) => (
        <div key={i} className={l.cls}>
          <span className="text-slate-600">{l.t} </span>
          {l.text}
        </div>
      ))}
    </div>
  );
}
