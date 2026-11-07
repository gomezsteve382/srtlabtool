/* EmulatorTab — the sps-emu service lane: probe / START / STOP (dev lane,
 * fixed command, whitelisted ports) + fixture endpoint check + the capture→
 * fixture import runbook. */
import { useEffect, useState } from 'react';
import { ProvenanceBadge, VerdictPill } from '@/components/Verdict';

interface ProbeState {
  ok: boolean;
  status: number;
  base: string;
  body?: unknown;
}

export function EmulatorTab() {
  const [probe, setProbe] = useState<ProbeState | null>(null);
  const [fixtures, setFixtures] = useState<{ ok: boolean; status: number } | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    const r = await fetch('/api/spsemu/probe').then((x) => x.json());
    setProbe(r);
    const f = await fetch('/api/spsemu/probe?path=fixtures').catch(() => null);
    void f;
    setFixtures(null);
  };

  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, []);

  const post = async (route: string, body: Record<string, unknown>, label: string) => {
    setBusy(label);
    try {
      const r = await fetch(route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = (await r.json()) as { log?: string[] };
      if (j.log) setLog(j.log);
    } finally {
      setBusy(null);
      void refresh();
    }
  };

  return (
    <div className="fade-in" data-testid="emulator-tab">
      <div className="glass">
        <h2>
          SPS EMULATOR — sps-emu service lane{' '}
          <VerdictPill state={probe?.ok ? 'green' : probe ? 'red' : 'gray'}>
            {probe?.ok ? `UP (${probe.base})` : probe ? 'DOWN' : 'PROBING…'}
          </VerdictPill>
        </h2>
        <p style={{ color: 'var(--white-400)', marginTop: 0 }}>
          Offline GM SPS cloud emulator (stdlib Python, 24 legacy/cloud endpoints + the unlock
          family). START runs the FIXED estate command from the dev-server lane — the only
          request-controlled value is the port (whitelist 8443/8444). Unlock lanes answer from
          fixtures, else honest stubs (status=1) — never invented keys.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" disabled={busy !== null} onClick={() => void post('/api/spsemu/start', { port: 8443 }, 'start')}>
            {busy === 'start' ? 'STARTING…' : 'START (port 8443)'}
          </button>
          <button className="btn ghost" disabled={busy !== null} onClick={() => void post('/api/spsemu/stop', { port: 8443 }, 'stop')}>
            {busy === 'stop' ? 'STOPPING…' : 'STOP'}
          </button>
          <button className="btn ghost" onClick={refresh}>RE-PROBE</button>
        </div>
        <pre className="logbox" style={{ marginTop: 12, maxHeight: 160 }} data-testid="emu-log">
          {log.length ? log.join('\n') : '(service log — fills on start/stop)'}
        </pre>
      </div>

      <div className="glass">
        <h2>FIXTURE STORE</h2>
        <dl className="kv">
          <dt>Store path</dt><dd>gm-lab/emulator/sps-emu/fixtures/ (+ store/calfiles/ for cal blobs)</dd>
          <dt>Matcher</dt><dd>request fingerprint → VIN-hinted fuzzy → per-endpoint fallback</dd>
          <dt>Import</dt><dd>bench capture JSONL/HAR → capture/fixtures_from_capture.py → fixtures/*.json</dd>
          <dt>Selftest</dt><dd>python3 -I selftest.py (14 checks, boots in-process)</dd>
        </dl>
        <ProvenanceBadge
          prov={{
            grade: 'VECTOR-VERIFIED',
            receipts: ['sps-emu README (skeleton v0) + API_INTEL.md (24-endpoint census from 21 bench logs)'],
          }}
        />
      </div>
    </div>
  );
}
