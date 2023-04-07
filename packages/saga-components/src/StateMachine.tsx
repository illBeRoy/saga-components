import { createNanoEvents } from 'nanoevents';
import type { SagaComponentGenerator } from './SagaComponentGenerator';
import { Memo, MemoCacheMiss } from './Memo';

export interface State {
  yieldedValue?: unknown;
  view?: JSX.Element;
}

export interface StateMachineOpts {
  memo: Memo;
}

export class StateMachine {
  private readonly events = createNanoEvents<{
    fork(stateHistory: State[]): void;
    readyToContinue(): void;
    done(): void;
  }>();

  private readonly generator: SagaComponentGenerator;
  private readonly memo: Memo;
  private readonly stateHistory: State[] = [];
  private status: 'running' | 'paused' | 'terminated' = 'paused';

  constructor(generator: SagaComponentGenerator, opts: StateMachineOpts) {
    this.generator = generator;
    this.memo = opts.memo;
  }

  continue() {
    while (this.status === 'paused') {
      this.next();
    }
  }

  terminate() {
    this.events.events = {};
    this.status = 'terminated';
  }

  replay(stateHistory: State[]) {
    if (stateHistory.length === 0) {
      return;
    }

    this.generator.next();
    for (const state of stateHistory.slice(0, -1)) {
      this.generator.next(state.yieldedValue);
      this.stateHistory.push(state);
    }
    this.stateHistory.push(stateHistory.at(-1)!);
  }

  view() {
    for (let i = this.stateHistory.length - 1; i >= 0; i -= 1) {
      const state = this.stateHistory[i];
      if (state.view) {
        return state.view;
      }
    }

    return <></>;
  }

  on = this.events.on.bind(this.events);

  private next(): void {
    if (!this.generator) {
      return;
    }

    this.status = 'running';

    const currentState = this.stateHistory.at(-1);

    const { value: yieldable, done } = this.generator.next(
      currentState?.yieldedValue
    );

    if (done) {
      this.stateHistory.push({ view: yieldable });
      this.done();
      return;
    }

    switch (yieldable.type) {
      case 'render': {
        this.stateHistory.push({ view: yieldable.jsx });
        this.ready();
        return;
      }

      case 'awaitFor': {
        const primaryMemoizationKey = this.stateHistory.length;

        if (yieldable.cacheBy) {
          const memoizedValue = this.memo.getMemoizedValueIfExists(
            primaryMemoizationKey,
            yieldable.cacheBy
          );

          if (memoizedValue !== MemoCacheMiss) {
            this.stateHistory.push({ yieldedValue: memoizedValue });
            this.ready();
            return;
          }
        }

        yieldable.promiseFactory().then((res) => {
          const shouldThisPromiseBeHandled = this.status !== 'terminated';

          if (shouldThisPromiseBeHandled) {
            if (yieldable.cacheBy) {
              this.memo.memoize(primaryMemoizationKey, yieldable.cacheBy, res);
            }
            this.stateHistory.push({ yieldedValue: res });
            this.ready();
          }
        });
        return;
      }

      case 'state': {
        const stateHistoryReplica = [...this.stateHistory];

        const setState = (value: unknown) =>
          this.fork([
            ...stateHistoryReplica,
            { yieldedValue: [value, setState] },
          ]);

        this.stateHistory.push({
          yieldedValue: [yieldable.defaultValue, setState],
        });

        this.ready();
        return;
      }

      case 'compute': {
        const primaryMemoizationKey = this.stateHistory.length;

        const memoizedValue = this.memo.getMemoizedValueIfExists(
          primaryMemoizationKey,
          yieldable.keys
        );

        if (memoizedValue !== MemoCacheMiss) {
          this.stateHistory.push({
            yieldedValue: memoizedValue,
          });
        } else {
          const value = yieldable.fn();
          this.memo.memoize(primaryMemoizationKey, yieldable.keys, value);
          this.stateHistory.push({
            yieldedValue: value,
          });
        }

        this.ready();
        return;
      }

      default: {
        throw new Error(
          `Unknown yielded value: ${yieldable}. Please yield only yieldable values from the saga-components library`
        );
      }
    }
  }

  private ready(): void {
    this.status = 'paused';
    this.events.emit('readyToContinue');
  }

  private done() {
    this.status = 'terminated';
    this.events.emit('done');
  }

  private fork(stateHistory: State[]) {
    this.events.emit('fork', stateHistory);
  }
}
