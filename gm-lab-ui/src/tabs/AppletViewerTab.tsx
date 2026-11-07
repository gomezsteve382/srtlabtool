/* AppletViewerTab — browse the generated applet identity catalog + unwrap a
 * dropped gzip applet / XML / BIN resource and classify it (read-only). */
import { useRef, useState } from 'react';
import { APPLET_CATALOG } from '@/lib/gm/appletCatalog.generated';
import { unwrapApplet, type UnwrapResult } from '@/lib/gm/applets';
import { ProvenanceBadge, VerdictPill } from '@/components/Verdict';

export function AppletViewerTab() {
  const [result, setResult] = useState<(UnwrapResult & { fileName: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const r = await unwrapApplet(bytes, file.name);
      setResult({ ...r, fileName: file.name });
    } finally {
      setBusy(false);
    }
  };

  const rows = APPLET_CATALOG.filter((r) =>
    filter
      ? `${r.appId} ${r.name} ${r.module} ${r.security}`.toLowerCase().includes(filter.toLowerCase())
      : true,
  );

  return (
    <div className="fade-in" data-testid="applets-tab">
      <div className="glass">
        <h2>APPLET VIEWER — spsCache gzip applets (39-applet identity map)</h2>
        <p style={{ color: 'var(--white-400)', marginTop: 0 }}>
          The MADDOG-2 census: 363 gzip entries in spsCacheInternal → 35 PE32 applets + 23 XML +
          305 BIN data resources. Drop a .gz below to gunzip + classify (read-only — nothing
          executes). XML ConfigurationModules yield the SecurityAlgo mappings.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".gz,.dll,.xml,.bin"
          data-testid="applet-file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
        {busy && <p>UNWRAPPING…</p>}
        {result && (
          <div style={{ marginTop: 12 }} data-testid="applet-result">
            <VerdictPill state="blue">{result.kind}</VerdictPill>{' '}
            <span className="mono">
              {result.fileName} · {result.size.toLocaleString()} B · sha256 {result.sha256.slice(0, 16)}…
            </span>
            <ul style={{ color: 'var(--white-300)', fontSize: 'var(--fs-mono)' }}>
              {result.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
            {result.catalogMatch && (
              <dl className="kv">
                <dt>App ID</dt><dd>{result.catalogMatch.appId}</dd>
                <dt>Name</dt><dd>{result.catalogMatch.name}</dd>
                <dt>Module</dt><dd>{result.catalogMatch.module}</dd>
                <dt>Security</dt><dd>{result.catalogMatch.security}</dd>
              </dl>
            )}
            {result.algoMappings && result.algoMappings.length > 0 && (
              <table className="data" style={{ marginTop: 8 }}>
                <thead><tr><th>EcuName</th><th>Diag addr</th><th>TableNo</th><th>AlgoNo</th><th>Effective</th></tr></thead>
                <tbody>
                  {result.algoMappings.map((m, i) => (
                    <tr key={i}>
                      <td>{m.ecuName}</td>
                      <td>{m.diagAddress}</td>
                      <td>{m.tableNo}</td>
                      <td>{m.algoNo}</td>
                      <td>0x{m.tableNo}{m.algoNo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <div className="glass">
        <h2>IDENTITY CATALOG ({rows.length}/{APPLET_CATALOG.length})</h2>
        <label className="field">
          <span>Filter</span>
          <input type="text" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="e.g. BcmOdo, IECS, dllsecurity…" />
        </label>
        <table className="data" data-testid="applet-catalog">
          <thead><tr><th>App ID</th><th>Internal name</th><th>Module</th><th>Build</th><th>Security family</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.appId}>
                <td>{r.appId}</td>
                <td className="mono">{r.name}</td>
                <td>{r.module}</td>
                <td>{r.build}</td>
                <td style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-micro)' }}>{r.security}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ProvenanceBadge
          prov={{
            grade: 'FACTORY-DLL DECODED',
            receipts: ['gm-lab/bleed/numeric_applets/NOTES.md (39-row identity map, RTTI-identified)'],
          }}
        />
      </div>
    </div>
  );
}
