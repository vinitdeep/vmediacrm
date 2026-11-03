import { tr } from './index';
import type { Namespace } from './registry';

/**
 * Module-level data with German texts (status maps, option lists, tab lists …): returns a read-through view whose strings
 * are translated when they are read, in the language active at that moment – `const LABEL = trData('ns', { open: 'Offen' })`.
 * A string without a catalog entry (codes, tones, keys) comes back unchanged, so only the texts change.
 */
export function trData<T>(ns: Namespace, value: T): T {
  const cache = new WeakMap<object, object>();
  const view = (o: object): object => {
    let p = cache.get(o);
    if (!p) {
      p = new Proxy(o, {
        get(target, key, receiver) {
          const v = Reflect.get(target, key, receiver);
          if (typeof key === 'symbol') return v;
          if (typeof v === 'string') return tr(ns)(v);
          return isPlain(v) ? view(v) : v;
        },
      });
      cache.set(o, p);
    }
    return p;
  };
  return (isPlain(value) ? view(value) : value) as T;
}

const isPlain = (v: unknown): v is object => {
  if (!v || typeof v !== 'object') return false;
  if (Array.isArray(v)) return true;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};
