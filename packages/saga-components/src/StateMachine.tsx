import { createNanoEvents } from 'nanoevents';
import type { SagaComponentGenerator } from './SagaComponentGenerator';
import { Memo, MemoCacheMiss } from './Memo';
import { ReplayableStateHistory, extractState } from './state';

export interface StateMachineOpts {
  memo: Memo;
}

export class StateMachine {
  private readonly events = createNanoEvents<{
    fork(replayableStateHistory: ReplayableStateHistory): void;
    readyToContinue(): void;
    done(): void;
  }>();

  private readonly generator: SagaComponentGenerator;
  private readonly memo: Memo;
  private readonly stateHistory: ReplayableStateHistory = [];
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

  replay(replayableHistory: ReplayableStateHistory) {
    if (replayableHistory.length === 0) {
      return;
    }

    this.generator.next();

    for (const stateOrStateFactory of replayableHistory.slice(0, -1)) {
      const state = extractState(stateOrStateFactory, this);
      this.generator.next(state.yieldedValue);
      this.stateHistory.push(state);
    }
    this.stateHistory.push(extractState(replayableHistory.at(-1)!, this));
  }

  view() {
    for (let i = this.stateHistory.length - 1; i >= 0; i -= 1) {
      const state = extractState(this.stateHistory[i], this);
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
      currentState && extractState(currentState, this).yieldedValue
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

        const setStateFor = (stateMachine: StateMachine) => (value: unknown) =>
          stateMachine.fork([
            ...stateHistoryReplica,
            (nextStateMachine) => ({
              yieldedValue: [value, setStateFor(nextStateMachine)],
            }),
          ]);

        this.stateHistory.push((stateMachine) => ({
          yieldedValue: [yieldable.defaultValue, setStateFor(stateMachine)],
        }));

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

  private fork(stateHistory: ReplayableStateHistory) {
    this.events.emit('fork', stateHistory);
  }
}
