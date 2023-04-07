export type Yieldables =
  | ReturnType<typeof awaitFor>
  | ReturnType<typeof render>
  | ReturnType<typeof useState>
  | ReturnType<typeof compute>;

export function awaitFor(
  promiseFactory: () => Promise<unknown>,
  opts?: { cacheBy?: unknown[] }
) {
  return {
    type: 'awaitFor',
    promiseFactory,
    cacheBy: opts?.cacheBy,
  } as const;
}

export function render(jsx: JSX.Element) {
  return {
    type: 'render',
    jsx,
  } as const;
}

export type State<T> = [value: T, setState: (value: T) => void];

export function useState(defaultValue: unknown) {
  return {
    type: 'state',
    defaultValue,
  } as const;
}

export function compute(fn: () => unknown, keys: unknown[]) {
  return {
    type: 'compute',
    fn,
    keys,
  } as const;
}
