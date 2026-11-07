/* SecurityConsoleTab — the 27 seed→key console + the three GM SA lanes.
 *
 * Lane 1 CGMSecurity:   2-byte BE seed → dllsecurity VM, ALGO runtime param
 *                       (picker spans all 256 Table C rows + the spsCache
 *                       module mappings, with the program disassembly shown).
 * Lane 2 CGM5Byte:      IVcs5B NOT decoded — the documented ~seed FALLBACK only,
 *                       stamped UNVERIFIED. Never presented as a live key.
 * Lane 3 CGlobalB:      delegation to the sps-emu unlock family (no local
 *                       fabrication — the unlock INPUT material is server-side).
 *
 * Plus the standalone keygen registry (GetKeyAlg L3/L5, legacy families,
 * s84 verify) — manual seed entry AND a live bridge seed pull. Every result
 * renders its provenance. Nothing here auto-fires: the live ladder runs only
 * on the operator's click, with the module address chosen on the form.
 */
import { useMemo, useState } from 'react';
import { ALGO_REGISTRY, findAlgo, type AlgoDef } from '@/lib/gm/algoRegistry';
import { DLLSEC_TABLEC } from '@/lib/gm/dllsecTableC.generated';
import { dllsecKey, disassembleDllsecRow, DLLSEC_PROVENANCE, isDllsecByteExact } from '@/lib/gm/dllsecVm';
import {
  cgmSecurity, cgm5ByteFallback, cglobalBUnlock,
  CGM_PROVENANCE, CGM5BYTE_PROVENANCE, CGLOBALB_PROVENANCE,
} from '@/lib/gm/securityLanes';
import { KNOWN_ALGO_MAPPINGS } from '@/lib/gm/capabilityMatrix';
import { createBridgeClient, getBridgeConfig, useBridgeStatus } from '@/lib/bridgeClient';
import { runSecurityAccess, type SaRunResult } from '@/lib/gm/uds27';
import { ProvenanceBadge, VerdictPill } from '@/components/Verdict';
import { GM_MODULES } from '@/lib/gm/moduleMap';

type Lane = 'registry' | 'cgm' | 'cgm5' | 'gb';

export function SecurityConsoleTab() {
  const [lane, setLane] = useState<Lane>('cgm');
  return (
    <div className="fade-in" data-testid="security-tab">
      <div className="glass">
        <h2>SECURITY LANES</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(
            [
              ['cgm', 'CGMSecurity (2-byte VM)'],
              ['cgm5', 'CGM5Byte (fallback only)'],
              ['gb', 'CGlobalB (IECS/S84)'],
              ['registry', 'Keygen registry'],
            ] as Array<[Lane, string]>
          ).map(([id, label]) => (
            <button key={id} className={lane === id ? 'btn' : 'btn ghost'} onClick={() => setLane(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {lane === 'cgm' && <CgmLane />}
      {lane === 'cgm5' && <Cgm5Lane />}
      {lane === 'gb' && <GlobalBLane />}
      {lane === 'registry' && <RegistryLane />}
    </div>
  );
}

/* ── Lane 1: CGMSecurity ──────────────────────────────────────────────────── */

function CgmLane() {
  const [seed, setSeed] = useState('1234');
  const [algoStr, setAlgoStr] = useState('F0BC');
  const [result, setResult] = useState<ReturnType<typeof cgmSecurity> | { error: string } | null>(null);

  const algo = Number.parseInt(algoStr.replace(/[^0-9a-fA-F]/g, '').padStart(4, '0'), 16) & 0xffff;
  const prov = DLLSEC_PROVENANCE(algo);

  const compute = () => {
    try {
      setResult(cgmSecurity(seed, algo));
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <div className="grid-2">
      <div className="glass" data-testid="cgm-lane">
        <h2>CGMSecurity — 2-byte lane</h2>
        <p style={{ color: 'var(--white-400)', marginTop: 0 }}>
          seed read BIG-ENDIAN → dllsecurity.dll SetSeedAndGetKey(seed, ALGO) → key BE.
          ALGO is a runtime parameter (applet law — no algo baked in any applet).
        </p>
        <label className="field">
          <span>Seed (2 bytes, first byte = HIGH)</span>
          <input type="text" value={seed} onChange={(e) => setSeed(e.target.value)} maxLength={8} />
        </label>
        <label className="field">
          <span>Algo (16-bit, effective = TableNo&lt;&lt;8 | AlgoNo)</span>
          <input type="text" value={algoStr} onChange={(e) => setAlgoStr(e.target.value)} maxLength={8} />
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={compute}>COMPUTE KEY</button>
          {KNOWN_ALGO_MAPPINGS.map((m) => (
            <button key={m.algo} className="btn ghost" onClick={() => setAlgoStr(m.algo.toString(16).padStart(4, '0').toUpperCase())}>
              {m.label.split(' ')[0]} → 0x{m.algo.toString(16).padStart(4, '0')}
            </button>
          ))}
        </div>
        <ResultView result={result} keyLabel="Key (BE)" />
        <ProvenanceBadge prov={prov} />
      </div>
      <ProgramBrowser algo={algo} />
    </div>
  );
}

function ProgramBrowser({ algo }: { algo: number }) {
  const rows = useMemo(() => {
    const out: Array<{ algo: number; program: string; badge: 'exact' | 'hyp' }> = [];
    for (let a = 0; a < 256; a++) {
      try {
        out.push({ algo: a, program: disassembleDllsecRow(a), badge: a <= 0x15 ? 'exact' : 'hyp' });
      } catch {
        out.push({ algo: a, program: '(unsupported opcodes — refused)', badge: 'hyp' });
      }
    }
    return out;
  }, []);
  return (
    <div className="glass">
      <h2>TABLE C PROGRAM BROWSER — row 0x{(algo & 0xff).toString(16).padStart(2, '0')} selected</h2>
      <p style={{ color: 'var(--white-400)', marginTop: 0 }}>
        The current algo&apos;s program: <span className="mono" style={{ color: 'var(--blue-300)' }}>{disassembleDllsecRow(algo)}</span>
      </p>
      <div className="logbox" style={{ maxHeight: 420 }}>
        {KNOWN_ALGO_MAPPINGS.map((m) => (
          <div key={m.algo} style={{ color: 'var(--blue-300)' }}>
            0x{m.algo.toString(16).padStart(4, '0')} {m.label} — {m.program}
          </div>
        ))}
        {rows.map((r) => (
          <div key={r.algo} style={r.badge === 'hyp' ? { opacity: 0.65 } : undefined}>
            0x{r.algo.toString(16).padStart(2, '0')}: {r.program}
            {r.badge === 'hyp' ? '  ·UNVERIFIED' : ''}
          </div>
        ))}
      </div>
      <ProvenanceBadge
        prov={{
          grade: 'BYTE-EXACT (ground-truth sweep)',
          receipts: ['Table C rows 0x00-0x15: full 65,536-seed sweep vs dllsec_algo_00..15.bin'],
          caveat: 'Rows 0x10-0xFF = DLL-extracted programs, NO ground truth — treat as hypotheses.',
        }}
      />
    </div>
  );
}

/* ── Lane 2: CGM5Byte ─────────────────────────────────────────────────────── */

function Cgm5Lane() {
  const [seed, setSeed] = useState('01 23 45 67 89');
  const [result, setResult] = useState<ReturnType<typeof cgm5ByteFallback> | { error: string } | null>(null);
  const compute = () => {
    try {
      setResult(cgm5ByteFallback(seed));
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : String(e) });
    }
  };
  return (
    <div className="glass" data-testid="cgm5-lane">
      <h2>CGM5ByteSecurity — 5-byte lane (FALLBACK ONLY)</h2>
      <p style={{ color: 'var(--white-400)', marginTop: 0 }}>
        The REAL 5-byte math is IVcs5B.dll RequestOperation(seed, 5, 10, key) — NOT decoded
        estate-side. What computes here is the applet&apos;s documented fallback
        <span className="mono"> key[i] = ~seed[i]</span>. Never send it to a live module without a
        captured pair confirming it.
      </p>
      <label className="field">
        <span>Seed (5 bytes hex)</span>
        <input type="text" value={seed} onChange={(e) => setSeed(e.target.value)} maxLength={20} />
      </label>
      <button className="btn" onClick={compute}>COMPUTE FALLBACK KEY</button>
      {result && 'keyHex' in result && (
        <div style={{ marginTop: 12 }}>
          <VerdictPill state="amber">FALLBACK KEY — UNVERIFIED</VerdictPill>
          <div className="hex-key" style={{ marginTop: 6 }} data-testid="cgm5-key">
            {result.keyHex.match(/.{2}/g)?.join(' ')}
          </div>
        </div>
      )}
      <ResultView result={result} keyLabel="Fallback key" amber />
      <ProvenanceBadge prov={CGM5BYTE_PROVENANCE} />
    </div>
  );
}

/* ── Lane 3: CGlobalB ─────────────────────────────────────────────────────── */

function GlobalBLane() {
  const st = useBridgeStatus(4000, getBridgeConfig().url);
  const [emuUrl, setEmuUrl] = useState('http://127.0.0.1:8443');
  const [seeds, setSeeds] = useState('AAAA');
  const [result, setResult] = useState<Awaited<ReturnType<typeof cglobalBUnlock>> | { error: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const ask = async () => {
    setBusy(true);
    try {
      setResult(await cglobalBUnlock(emuUrl, { seeds: seeds.split(/[\s,]+/).filter(Boolean) }));
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass" data-testid="gb-lane">
      <h2>CGlobalBSecurity — IECS / S84 delegation</h2>
      <p style={{ color: 'var(--white-400)', marginTop: 0 }}>
        Global B (2019+) delegates to IECS (server JSON) + S84 (AES-128-CMAC finisher). The unlock
        INPUT material is server-side — this lane delegates to the sps-emu unlock family and never
        fabricates keys. Start the emulator from the EMULATOR tab.
      </p>
      <label className="field">
        <span>sps-emu base URL</span>
        <input type="text" value={emuUrl} onChange={(e) => setEmuUrl(e.target.value)} />
      </label>
      <label className="field">
        <span>Seed material (space-separated, base64 or hex)</span>
        <input type="text" value={seeds} onChange={(e) => setSeeds(e.target.value)} />
      </label>
      <button className="btn" onClick={ask} disabled={busy}>{busy ? 'ASKING…' : 'ASK UNLOCK FAMILY'}</button>
      {result && 'statuses' in result && (
        <div style={{ marginTop: 12 }}>
          {result.statuses.length === 0 && <VerdictPill state="amber">NO STATUSES (stub or fixture miss)</VerdictPill>}
          {result.statuses.map((s, i) => (
            <div key={i} className="mono" style={{ marginTop: 4 }}>
              seed {s.seed} → {s.key ?? '(no key served)'}{' '}
              <VerdictPill state={s.status === 0 ? 'green' : 'amber'}>{s.status === 0 ? 'STATUS 0' : `STATUS ${s.status}`}</VerdictPill>
            </div>
          ))}
        </div>
      )}
      <ResultView result={result} keyLabel="Response" />
      <ProvenanceBadge prov={CGLOBALB_PROVENANCE} />
      <p style={{ color: 'var(--white-400)', fontSize: 'var(--fs-micro)', marginTop: 8 }}>
        (Bridge at {st.url}: {st.ok ? 'up' : 'down'} — Global-B classic-CAN fallback shape exists, DoIP is the Phase-3 lane.)
      </p>
    </div>
  );
}

/* ── Registry lane + live ladder ──────────────────────────────────────────── */

function RegistryLane() {
  const st = useBridgeStatus();
  const [algoId, setAlgoId] = useState(ALGO_REGISTRY[0].id);
  const [seed, setSeed] = useState('1234');
  const [manual, setManual] = useState<{ keyHex: string } | { error: string } | null>(null);
  const [ladder, setLadder] = useState<SaRunResult | null>(null);
  const [txId, setTxId] = useState('0x7e0');
  const [rxId, setRxId] = useState('0x7e8');
  const [levelBase, setLevelBase] = useState(2);
  const [busy, setBusy] = useState(false);

  const algo: AlgoDef | undefined = findAlgo(algoId);

  const computeManual = () => {
    if (!algo) return;
    setManual(algo.compute(seed));
  };

  const runLadder = async () => {
    if (!algo) return;
    setBusy(true);
    setLadder(null);
    try {
      const bridge = createBridgeClient(getBridgeConfig().url);
      const r = await runSecurityAccess(bridge, {
        txId: Number.parseInt(txId, 16),
        rxId: Number.parseInt(rxId, 16),
        requestLevel: levelBase * 2 + 1,
        algoId: algo.id,
        sessionPayload: '1003',
        compute: (seedBeHex) => {
          // CGMSecurity law: the wire seed bytes ARE BE — feed them as-is to 2-byte algos.
          if (algo.seedBytes === 2) return algo.compute(seedBeHex);
          return algo.compute(seedBeHex);
        },
      });
      setLadder(r);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid-2">
      <div className="glass" data-testid="registry-lane">
        <h2>KEYGEN REGISTRY</h2>
        <label className="field">
          <span>Algorithm</span>
          <select value={algoId} onChange={(e) => { setAlgoId(e.target.value); setManual(null); }}>
            {ALGO_REGISTRY.map((a) => (
              <option key={a.id} value={a.id}>
                [{a.family}] {a.label}
              </option>
            ))}
          </select>
        </label>
        {algo && (
          <dl className="kv" style={{ marginBottom: 12 }}>
            <dt>Family</dt><dd>{algo.family}</dd>
            <dt>Modules</dt><dd>{algo.modules.join(', ') || '—'}</dd>
            <dt>Seed</dt><dd>{algo.seedBytes} bytes</dd>
          </dl>
        )}
        <label className="field">
          <span>Seed (hex)</span>
          <input type="text" value={seed} onChange={(e) => setSeed(e.target.value)} />
        </label>
        <button className="btn" onClick={computeManual}>COMPUTE</button>
        {manual && 'keyHex' in manual && (
          <div style={{ marginTop: 12 }} data-testid="registry-key">
            <div className="hex-key">{manual.keyHex}</div>
          </div>
        )}
        <ResultView result={manual} keyLabel="Key" />
        {algo && <ProvenanceBadge prov={algo.provenance} />}
      </div>

      <div className="glass" data-testid="live-ladder">
        <h2>LIVE 27 LADDER</h2>
        <VerdictPill state={st.ok ? 'green' : 'gray'}>{st.ok ? 'BRIDGE OK' : 'BRIDGE DOWN'}</VerdictPill>
        <div className="grid-3" style={{ marginTop: 12 }}>
          <label className="field">
            <span>TX id</span>
            <input type="text" value={txId} onChange={(e) => setTxId(e.target.value)} />
          </label>
          <label className="field">
            <span>RX id</span>
            <input type="text" value={rxId} onChange={(e) => setRxId(e.target.value)} />
          </label>
          <label className="field">
            <span>SA base (level = base×2+1)</span>
            <input type="number" min={1} max={62} value={levelBase} onChange={(e) => setLevelBase(Number(e.target.value))} />
          </label>
        </div>
        <button className="btn" onClick={runLadder} disabled={busy || !st.ok || !algo}>
          {busy ? 'RUNNING…' : 'RUN 27 LADDER'}
        </button>
        <p style={{ color: 'var(--white-400)', fontSize: 'var(--fs-micro)' }}>
          Applet law: NRC 0x37 → retry ×10 @1 s; NRC 0x35 → one seed re-request. 10 03 sent first.
        </p>
        {ladder && (
          <div>
            <VerdictPill state={ladder.unlocked ? 'green' : 'red'}>
              {ladder.unlocked ? 'UNLOCKED' : 'NOT UNLOCKED'}
            </VerdictPill>
            <div className="logbox" style={{ marginTop: 8 }} data-testid="ladder-log">
              {ladder.attempts.map((a, i) => (
                <div key={i}>
                  TX {a.request} → RX {a.response || '(silence)'}
                  {a.nrc ? `  [NRC ${a.nrc}]` : ''}
                </div>
              ))}
            </div>
          </div>
        )}
        <h3>Module address cheat-sheet</h3>
        <div className="logbox" style={{ maxHeight: 160 }}>
          {GM_MODULES.filter((m) => m.canReq !== undefined).map((m) => (
            <div key={m.id}>
              {m.name}: 0x{m.canReq?.toString(16)} / 0x{m.canResp?.toString(16)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── shared result view ───────────────────────────────────────────────────── */

function ResultView(
  props: { result: unknown; keyLabel: string; amber?: boolean },
) {
  const r = props.result as { keyHex?: string; error?: string; program?: string } | null;
  if (!r || typeof r !== 'object') return null;
  if ('error' in r && r.error) {
    return (
      <div style={{ marginTop: 12 }} data-testid="algo-error">
        <VerdictPill state="red">REFUSED</VerdictPill>
        <div style={{ color: 'var(--red-400)', marginTop: 4 }}>{r.error}</div>
      </div>
    );
  }
  if ('keyHex' in r && r.keyHex) {
    return (
      <div style={{ marginTop: 12 }}>
        <div style={{ color: 'var(--white-400)', fontSize: 'var(--fs-label)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          {props.keyLabel}
        </div>
        <div className="hex-key" data-testid="algo-key">{r.keyHex.match(/.{2}/g)?.join(' ')}</div>
        {r.program && <div style={{ color: 'var(--white-400)', fontSize: 'var(--fs-micro)', marginTop: 4 }}>{r.program}</div>}
      </div>
    );
  }
  return null;
}

export { isDllsecByteExact, dllsecKey, DLLSEC_TABLEC };
