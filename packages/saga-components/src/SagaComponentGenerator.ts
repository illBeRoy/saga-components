import type { Yieldables } from './yieldables';

export type SagaComponentFactory<TProps extends {} = {}> = (
  props: TProps
) => SagaComponentGenerator;

export type SagaComponentGenerator = Generator<Yieldables, JSX.Element, any>;
