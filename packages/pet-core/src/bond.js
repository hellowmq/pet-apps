/**
 * Pure intimacy counter — no DOM. Hosts/UI subscribe for display.
 * @param {number} [initial=0]
 */
export function createBond(initial = 0) {
  let value = initial;
  const subs = new Set();

  return {
    getBond: () => value,
    addBond(n = 1) {
      value += n;
      for (const fn of subs) fn(value);
      return value;
    },
    /**
     * @param {(v: number) => void} fn
     * @returns {() => void} unsubscribe
     */
    subscribe(fn) {
      subs.add(fn);
      fn(value);
      return () => subs.delete(fn);
    },
    dispose() {
      subs.clear();
    },
  };
}
