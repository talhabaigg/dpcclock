// Stage-3 ECMAScript "upsert" proposal — already shipped in Chrome 132+ /
// Firefox 137+, but missing on Safari (incl. recent iPadOS). PDF.js v5 calls
// these on internal Maps and crashes with "getOrInsertComputed is not a
// function" on iPad. Polyfill before any PDF.js code runs.
// Spec: https://tc39.es/proposal-upsert/

interface UpsertableMap<K, V> {
    has(key: K): boolean;
    get(key: K): V | undefined;
    set(key: K, value: V): unknown;
    getOrInsert?: (key: K, value: V) => V;
    getOrInsertComputed?: (key: K, callbackFn: (key: K) => V) => V;
}

type UpsertablePrototype = UpsertableMap<unknown, unknown>;

const installOnPrototype = (proto: UpsertablePrototype | null | undefined): void => {
    if (!proto) return;

    if (typeof proto.getOrInsert !== 'function') {
        proto.getOrInsert = function (this: UpsertableMap<unknown, unknown>, key: unknown, value: unknown) {
            if (!this.has(key)) this.set(key, value);
            return this.get(key)!;
        };
    }

    if (typeof proto.getOrInsertComputed !== 'function') {
        proto.getOrInsertComputed = function (
            this: UpsertableMap<unknown, unknown>,
            key: unknown,
            callbackFn: (key: unknown) => unknown,
        ) {
            if (!this.has(key)) this.set(key, callbackFn(key));
            return this.get(key)!;
        };
    }
};

installOnPrototype(Map.prototype as UpsertablePrototype);
installOnPrototype(WeakMap.prototype as unknown as UpsertablePrototype);
