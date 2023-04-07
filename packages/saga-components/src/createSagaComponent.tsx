import { ComponentType, useRef } from 'react';
import { shallowEqualObjects } from 'shallow-equal';
import type { SagaComponentFactory } from './SagaComponentGenerator';
import { useRerender } from './rerender';
import { State, StateMachine } from './StateMachine';
import { Memo } from './Memo';

export function createSagaComponent<TProps extends {}>(
  SagaComponentGenerator: SagaComponentFactory<TProps>
): ComponentType<TProps> {
  const SagaComponent = (props: TProps) => {
    const stateMachine = useRef<StateMachine>();
    const usedProps = useRef(props);
    const memo = useRef(new Memo());
    const isRendering = useRef(false);
    const rerender = useRerender();

    function rerenderIfNotCurrentlyRendering() {
      if (!isRendering.current) {
        rerender();
      }
    }

    function forkStateMachine(stateHistory?: State[]) {
      stateMachine.current?.terminate();

      stateMachine.current = new StateMachine(SagaComponentGenerator(props), {
        memo: memo.current,
      });

      if (stateHistory) {
        stateMachine.current.replay(stateHistory);
      }

      stateMachine.current.on(
        'readyToContinue',
        rerenderIfNotCurrentlyRendering
      );

      stateMachine.current.on('done', rerenderIfNotCurrentlyRendering);

      stateMachine.current.on('fork', (stateHistory) => {
        forkStateMachine(stateHistory);
        rerenderIfNotCurrentlyRendering();
      });

      usedProps.current = props;
    }

    isRendering.current = true;

    if (
      !stateMachine.current ||
      !shallowEqualObjects(usedProps.current, props)
    ) {
      forkStateMachine();
    }

    stateMachine.current!.continue();

    isRendering.current = false;

    return stateMachine.current!.view();
  };

  return SagaComponent;
}
