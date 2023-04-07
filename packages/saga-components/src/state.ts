import type { StateMachine } from './StateMachine';

export interface State {
  yieldedValue?: unknown;
  view?: JSX.Element;
}

export type StateFactory = (stateMachine: StateMachine) => State;

export type StateHistory = State[];

export type ReplayableStateHistory = (State | StateFactory)[];

export const isStateFactory = (
  stateOrStateFactory: State | StateFactory
): stateOrStateFactory is StateFactory => {
  return typeof stateOrStateFactory === 'function';
};

export const extractState = (
  stateOrStateFactory: State | StateFactory,
  stateMachine: StateMachine
): State => {
  if (isStateFactory(stateOrStateFactory)) {
    return stateOrStateFactory(stateMachine);
  } else {
    return stateOrStateFactory;
  }
};
