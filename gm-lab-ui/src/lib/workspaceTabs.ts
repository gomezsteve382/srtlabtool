/* ============================================================================
 * workspaceTabs.ts — the GM LAB tab registry (cloned 1:1 from the srt-lab
 * twin's architecture: ordered registry, load-bearing ids for deep links,
 * icons resolved in components/tabIcons.tsx keyed on `id`).
 * ========================================================================== */

export interface WorkspaceTab {
  id: string;
  l: string; // label
  s: string; // subtitle
  /** Gate: tab renders but marked EXPERIMENTAL when true. */
  experimental?: boolean;
}

export const WORKSPACE_TABS: WorkspaceTab[] = [
  { id: 'dashboard', l: 'DASHBOARD', s: 'Module survey · VIN + part reads across the GM set · bridge status' },
  { id: 'security', l: 'SECURITY CONSOLE', s: '27 seed→key · every decoded GM algo · CGMSecurity / 5-byte / Global-B lanes' },
  { id: 'vincensus', l: 'VIN CENSUS', s: 'Multi-module VIN read + compare panel' },
  { id: 'vinwrite', l: 'VIN WRITE', s: '2E F1 90 lane · security gate · per-module capability matrix' },
  { id: 'mileage', l: 'MILEAGE', s: 'Odometer read/write per the capability matrix · BcmOdoList ceremony' },
  { id: 'marry', l: 'MARRY', s: 'BCM/IPC/ECM set coherence · key + marry state panel' },
  { id: 'pin', l: 'PIN', s: 'decode-and-MATCH against the 2^20 IM608 GM PIN table — no VIN derivation (K_RULING)' },
  { id: 'keys', l: 'KEYS', s: 'Key programming + PIN stack: ceremony player, brute-force lane, banked law' },
  { id: 'applets', l: 'APPLET VIEWER', s: 'gzip spsCache applets · unwrap + extracted security params per module' },
  { id: 'emulator', l: 'EMULATOR', s: 'sps-emu service lane · fixture store · capture→fixture import' },
  { id: 'analyzer', l: 'SESSION ANALYZER', s: 'sps2 / iecs log timelines · UDS session shapes' },
  { id: 'doip', l: 'DOIP', s: 'Global B DoIP lane stub', experimental: true },
];

export const TAB_IDS = WORKSPACE_TABS.map((t) => t.id);

export function isKnownTab(id: string): boolean {
  return TAB_IDS.includes(id);
}

/** Deep-link redirect map (retired ids → replacement). */
export const TAB_REDIRECTS: Record<string, string> = {};
