/* tabIcons — lucide icon map keyed on tab id (the twin's pattern). */
import {
  Gauge, ShieldCheck, ScanSearch, PenLine, GaugeCircle, Link2, KeyRound, KeySquare,
  PackageOpen, Server, Waves, Network, Circle,
} from 'lucide-react';
import type { ComponentType } from 'react';

const MAP: Record<string, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  dashboard: Gauge,
  security: ShieldCheck,
  vincensus: ScanSearch,
  vinwrite: PenLine,
  mileage: GaugeCircle,
  marry: Link2,
  pin: KeyRound,
  keys: KeySquare,
  applets: PackageOpen,
  emulator: Server,
  analyzer: Waves,
  doip: Network,
};

export function tabIcon(id: string): ComponentType<{ size?: number; strokeWidth?: number }> {
  return MAP[id] ?? Circle;
}
