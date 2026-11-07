/* SessionAnalyzerTab — drop a bench SPS log (sps2 / iecs / ivcs5b …), get the
 * ordered timeline + endpoint census + failure list (sessionAnalyzer.ts). */
import { useRef, useState } from 'react';
import { parseSessionLog, type AnalyzerReport } from '@/lib/gm/sessionAnalyzer';
import { VerdictPill } from '@/components/Verdict';

export function SessionAnalyzerTab() {
  const [report, setReport] = useState<(AnalyzerReport & { fileName: string }) | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File) => {
    const text = await file.text();
    setReport({ ...parseSessionLog(text), fileName: file.name });
  };

  return (
    <div className="fade-in" data-testid="analyzer-tab">
      <div className="glass">
        <h2>SESSION ANALYZER — SPS bench logs</h2>
        <p style={{ color: 'var(--white-400)', marginTop: 0 }}>
          Parses the estate log4j shape ({'<ts>|<LEVEL>|<thread>|<Class>:<line>|<message>'}), builds
          the ordered timeline, the endpoint census and the failure list — the same lanes
          API_INTEL.md mined by hand from the 21-session corpus.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".log,.txt"
          data-testid="analyzer-file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
      </div>

      {report && (
        <>
          <div className="glass">
            <h2>
              {report.fileName}{' '}
              <VerdictPill state="blue">
                {report.parsedLines}/{report.totalLines} lines · {report.endpoints.length} endpoints ·{' '}
                {report.failCount} fails
              </VerdictPill>
            </h2>
            {report.sessionStart && (
              <p style={{ color: 'var(--white-400)' }}>
                session {report.sessionStart} → {report.sessionEnd}
              </p>
            )}
            <table className="data" data-testid="endpoint-census">
              <thead><tr><th>Endpoint</th><th>Calls</th><th>Fails</th></tr></thead>
              <tbody>
                {report.endpoints.map((e) => (
                  <tr key={e.endpoint}>
                    <td className="mono">{e.endpoint}</td>
                    <td>{e.count}</td>
                    <td>{e.fails > 0 ? <VerdictPill state="amber">{e.fails}</VerdictPill> : e.fails}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="glass">
            <h2>TIMELINE</h2>
            <div className="logbox" style={{ maxHeight: 420 }} data-testid="timeline">
              {report.events
                .filter((e) => e.kind !== 'info' || e.level !== 'DEBUG')
                .slice(0, 500)
                .map((e, i) => (
                  <div key={i}>
                    +{String(e.ms ?? 0).padStart(6, ' ')} ms [{e.kind.toUpperCase().padEnd(8)}] {e.message.slice(0, 150)}
                  </div>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
