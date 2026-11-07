/* PlaceholderTab — honest Phase-N stub for tabs wired in later phases. */
export function PlaceholderTab(props: { id: string; title: string; phase: string; notes?: string }) {
  return (
    <div className="fade-in glass" data-testid={`tab-${props.id}`}>
      <h2>{props.title}</h2>
      <p style={{ color: 'var(--white-300)' }}>
        Wired in <strong>{props.phase}</strong>. The registry slot, routing and this stub exist so
        the shell is complete from Phase 1 — the twin&apos;s architecture law.
      </p>
      {props.notes && <p style={{ color: 'var(--white-400)' }}>{props.notes}</p>}
    </div>
  );
}
