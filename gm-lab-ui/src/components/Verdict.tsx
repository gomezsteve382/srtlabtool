/* Shared verdict/provenance components — the honesty UI spine. */
import type { Provenance } from '@/lib/gm/provenance';
import { PROVENANCE_TINT } from '@/lib/gm/provenance';

export function ProvenanceBadge({ prov }: { prov: Provenance }) {
  return (
    <div className="prov" data-testid="provenance">
      <span className="grade" style={{ color: PROVENANCE_TINT[prov.grade] }}>
        {prov.grade}
      </span>
      {prov.receipts.length > 0 && (
        <div>
          {prov.receipts.map((r, i) => (
            <div key={i}>{r}</div>
          ))}
        </div>
      )}
      {prov.caveat && <div style={{ marginTop: 2 }}>{prov.caveat}</div>}
    </div>
  );
}

export function VerdictPill(props: { state: 'green' | 'red' | 'amber' | 'blue' | 'gray'; children: React.ReactNode }) {
  return <span className={`pill ${props.state}`}>{props.children}</span>;
}
