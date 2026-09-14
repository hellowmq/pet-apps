import { describe, it, expect, vi } from 'vitest';
import { createBond } from '../src/bond.js';

describe('createBond', () => {
  it('starts at 0 and notifies subscribers on addBond', () => {
    const bond = createBond();
    const spy = vi.fn();
    bond.subscribe(spy);
    expect(bond.getBond()).toBe(0);
    bond.addBond(2);
    expect(bond.getBond()).toBe(2);
    expect(spy).toHaveBeenCalledWith(2);
  });

  it('unsubscribe stops notifications', () => {
    const bond = createBond();
    const spy = vi.fn();
    const unsub = bond.subscribe(spy);
    expect(spy).toHaveBeenCalledWith(0);
    spy.mockClear();
    unsub();
    bond.addBond(1);
    expect(spy).not.toHaveBeenCalled();
  });
});
