import { shallowEqualArrays } from 'shallow-equal';

export const MemoCacheMiss = Symbol('MemoCacheMiss');

export class Memo {
  private readonly memoizedValues: Map<number, [unknown[], unknown][]> =
    new Map();

  memoize(primaryKey: number, args: unknown[], value: unknown) {
    if (!this.memoizedValues.has(primaryKey)) {
      this.memoizedValues.set(primaryKey, []);
    }

    const memoizedForPK = this.memoizedValues.get(primaryKey)!;
    if (!memoizedForPK.some((memo) => shallowEqualArrays(memo[0], args))) {
      memoizedForPK.push([args, value]);
    }
  }

  getMemoizedValueIfExists(
    primaryKey: number,
    args: unknown[]
  ): unknown | typeof MemoCacheMiss {
    const memoizedForPK = this.memoizedValues.get(primaryKey);
    const memoizedValue = memoizedForPK?.find((memo) =>
      shallowEqualArrays(memo[0], args)
    );

    if (memoizedValue) {
      return memoizedValue[1];
    } else {
      return MemoCacheMiss;
    }
  }
}
