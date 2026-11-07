/* PinTab — GM PIN: decode-and-MATCH against the 2^20-entry IM608 table via
 * the dev-server lane (the 8 MB bin never leaves disk). K_RULING enforced in
 * the UI copy and the lane: index lookup + PIN-pair match ONLY — no VIN
 * derivation exists anywhere in this feature. */
import { useEffect, useState } from 'react';
import { createGmpinsClient, parsePinIndex, parsePinPair, type PinAtResult, type PinMatchResult } from '@/lib/gm/pinLookup';
import { VerdictPill } from '@/components/Verdict';

export function PinTab() {
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [laneError, setLaneError] = useState<string | null>(null);
  const [idxText, setIdxText] = useState('00000');
  const [atResult, setAtResult] = useState<PinAtResult | { error: string } | null>(null);
  const [f1, setF1] = useState('3051');
  const [f2, setF2] = useState('9903');
  const [matchResult, setMatchResult] = useState<PinMatchResult | { error: string } | null>(null);

  useEffect(() => {
    createGmpinsClient()
      .stats()
      .then(setStats)
      .catch((e) => setLaneError(e instanceof Error ? e.message : String(e)));
  }, []);

  const doAt = () => {
    const idx = parsePinIndex(idxText);
    if (typeof idx === 'object') {
      setAtResult(idx);
      return;
    }
    createGmpinsClient()
      .at(idx)
      .then(setAtResult)
      .catch((e) => setAtResult({ error: e instanceof Error ? e.message : String(e) }));
  };

  const doMatch = () => {
    const pair = parsePinPair(f1, f2);
    if ('error' in pair) {
      setMatchResult({ error: pair.error });
      return;
    }
    createGmpinsClient()
      .match(pair.f1, pair.f2)
      .then(setMatchResult)
      .catch((e) => setMatchResult({ error: e instanceof Error ? e.message : String(e) }));
  };

  return (
    <div className="fade-in" data-testid="pin-tab">
      <div className="glass">
        <h2>
          GM PIN — DECODE-AND-MATCH{' '}
          <VerdictPill state={stats ? 'green' : laneError ? 'red' : 'gray'}>
            {stats ? `LANE OK · ${stats.entries?.toLocaleString?.() ?? '?'} entries` : laneError ? 'LANE DOWN' : 'PROBING…'}
          </VerdictPill>
        </h2>
        <p style={{ color: 'var(--white-400)', marginTop: 0 }}>
          The IM608&apos;s offline GM PIN table (GM/Immo.tab → gm_pins.bin), served by a read-only
          dev lane — the binary never leaves disk. <strong>K_RULING LAW: decode-and-match ONLY.</strong>{' '}
          The 20-bit index is NOT derivable from VIN — there is deliberately no pin-for-VIN feature.
        </p>
        {laneError && <p style={{ color: 'var(--red-400)' }}>{laneError}</p>}
      </div>

      <div className="grid-2">
        <div className="glass">
          <h2>INDEX LOOKUP</h2>
          <label className="field">
            <span>Index (hex, 0x00000..0xFFFFF)</span>
            <input type="text" value={idxText} onChange={(e) => setIdxText(e.target.value)} maxLength={7} />
          </label>
          <button className="btn" onClick={doAt} disabled={!stats}>LOOK UP</button>
          {atResult && (
            <div style={{ marginTop: 12 }} data-testid="pin-at">
              {'error' in atResult ? (
                <VerdictPill state="red">{atResult.error}</VerdictPill>
              ) : (
                <>
                  <div className="hex-key">{atResult.field1} {atResult.field2}</div>
                  <div style={{ color: 'var(--white-400)', fontSize: 'var(--fs-micro)' }}>
                    index 0x{atResult.index.toString(16).padStart(5, '0')}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="glass">
          <h2>PAIR MATCH (find indexes for a PIN)</h2>
          <div className="grid-2">
            <label className="field">
              <span>Field 1 (4 digits)</span>
              <input type="text" value={f1} onChange={(e) => setF1(e.target.value)} maxLength={4} />
            </label>
            <label className="field">
              <span>Field 2 (4 digits)</span>
              <input type="text" value={f2} onChange={(e) => setF2(e.target.value)} maxLength={4} />
            </label>
          </div>
          <button className="btn" onClick={doMatch} disabled={!stats}>SEARCH TABLE</button>
          {matchResult && (
            <div style={{ marginTop: 12 }} data-testid="pin-match">
              {'error' in matchResult ? (
                <VerdictPill state="red">{matchResult.error}</VerdictPill>
              ) : matchResult.hits.length === 0 ? (
                <VerdictPill state="amber">NO MATCHES</VerdictPill>
              ) : (
                <>
                  <VerdictPill state="green">{matchResult.hits.length} HIT{matchResult.hits.length > 1 ? 'S' : ''}</VerdictPill>
                  <div className="logbox" style={{ marginTop: 8, maxHeight: 160 }}>
                    {matchResult.hits.map((h) => `0x${h.toString(16).padStart(5, '0')}`).join('\n')}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
