import { describe, expect, it } from 'vitest';
import {
  addKeyPlan,
  buildBruteForcePlan,
  candidates,
  classifyAttempt,
  candidateHex,
  recycleCeremony,
} from '@/lib/gm/keyLearn';

describe('brute-force plan', () => {
  it('defaults cover the full 16-bit space', () => {
    const p = buildBruteForcePlan();
    expect(p.start).toBe(0);
    expect(p.end).toBe(0x10000);
    expect([...candidates(p)]).toHaveLength(0x10000);
  });
  it('honors custom bounds', () => {
    const p = buildBruteForcePlan({ start: 0x10, end: 0x20 });
    expect([...candidates(p)]).toEqual(Array.from({ length: 0x10 }, (_, i) => 0x10 + i));
  });
  it('refuses inverted or oversized ranges', () => {
    expect(() => buildBruteForcePlan({ start: 5, end: 5 })).toThrow();
    expect(() => buildBruteForcePlan({ start: 0, end: 0x20000 })).toThrow();
  });
  it('formats candidates as K+hex4', () => {
    expect(candidateHex(0)).toBe('K0000');
    expect(candidateHex(0xabcd)).toBe('KABCD');
  });
});


describe('attempt classification — the banked response law', () => {
  const plan = buildBruteForcePlan();
  it('positive on 67 key-level', () => {
    const v = classifyAttempt('6702', plan);
    expect(v.kind).toBe('positive');
    expect(v.delayMs).toBe(0);
  });
  it('delay on NRC 0x37', () => {
    const v = classifyAttempt('7F2737', plan);
    expect(v.kind).toBe('nrc-delay');
    expect(v.nrc).toBe('37');
    expect(v.delayMs).toBe(plan.attemptDelayMs);
  });
  it('locked on 0x35/0x36 and the banked FE02 pattern', () => {
    expect(classifyAttempt('7F2735', plan).kind).toBe('nrc-locked');
    expect(classifyAttempt('7F2736', plan).kind).toBe('nrc-locked');
    const v = classifyAttempt('FE02 Controller Locked', plan);
    expect(v.kind).toBe('nrc-locked');
    expect(v.delayMs).toBe(plan.lockedDelayMs);
  });
  it('empty response = small delay, other NRC recorded', () => {
    expect(classifyAttempt('', plan).kind).toBe('empty');
    expect(classifyAttempt('7F2731', plan).kind).toBe('nrc-other');
  });
});

describe('ceremonies', () => {
  it('recycle ceremony carries every banked step in order', () => {
    const steps = recycleCeremony().map((s) => s.id);
    expect(steps).toEqual([
      'virginize', 'wait11', 'clear-dtc', 'read-vin', 'clear-vin',
      'read-progdate', 'clear-progdate', 'clear-pin', 'power-cycle', 'readmit',
    ]);
    const wait11 = recycleCeremony().find((s) => s.id === 'wait11');
    expect(wait11?.holdMs).toBe(11 * 60 * 1000);
  });
  it('add-key plan always opens with session then 27 01', () => {
    const steps = addKeyPlan({ id: 'test', txId: 0x7e2, rxId: 0x7ea });
    expect(steps[0].payload).toBe('1003');
    expect(steps[1].payload).toBe('2701');
  });
});
