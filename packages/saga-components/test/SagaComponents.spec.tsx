import { act, fireEvent, waitFor } from '@testing-library/react';
import delay from 'delay';
import {
  renderComponent,
  renderComponentWithMultipleProps,
} from './utils/render';
import {
  createSagaComponent,
  State,
  awaitFor,
  render,
  useState,
  compute,
} from '../src';

describe('SagaComponents', () => {
  describe('Basic Saga Component', () => {
    it('should return the JSX from the saga component', () => {
      //eslint-disable-next-line
      const SagaComponent = createSagaComponent(function* () {
        return <span>Hi Saga</span>;
      });

      const output = renderComponent(<SagaComponent />);
      expect(output.container.innerHTML).toEqual('<span>Hi Saga</span>');
    });

    it('should support props', () => {
      //eslint-disable-next-line
      const SagaComponent = createSagaComponent(function* ({name}: {name: string}) {
        return <span>Hi {name}</span>;
      });

      const output = renderComponent(<SagaComponent name="Roy" />);
      expect(output.container.innerHTML).toEqual('<span>Hi Roy</span>');
    });

    it('should support updating the props', async () => {
      //eslint-disable-next-line
      const SagaComponent = createSagaComponent(function* ({name}: {name: string}) {
        return <span>Hi {name}</span>;
      });

      const output = renderComponentWithMultipleProps(SagaComponent)
        .withProps({ name: 'Roy' })
        .withProps({ name: 'Matan' })
        .render();

      await act(() => delay(1000));

      expect(output.container.innerHTML).toEqual('<span>Hi Matan</span>');
    });
  });

  describe('Yielding Async Actions', () => {
    it('should allow awaiting promises through yielding', async () => {
      const SagaComponent = createSagaComponent(function* () {
        yield awaitFor(() => delay(1000));
        return <span>awaited!</span>;
      });

      const output = renderComponent(<SagaComponent />);
      await act(() => delay(1000));

      expect(output.container.innerHTML).toEqual('<span>awaited!</span>');
    });

    it('should resume the saga with the results of the promise', async () => {
      async function getName() {
        await delay(1000);
        return 'Matan';
      }

      const SagaComponent = createSagaComponent(function* () {
        const name: string = yield awaitFor(() => getName());
        return <span>awaited for {name}!</span>;
      });

      const output = renderComponent(<SagaComponent />);
      await act(() => delay(1000));

      expect(output.container.innerHTML).toEqual(
        '<span>awaited for Matan!</span>'
      );
    });

    it('should rerun yielded promise if props have changed', async () => {
      const SagaComponent = createSagaComponent(function* ({
        name,
      }: {
        name: string;
      }) {
        const awaitedName: string = yield awaitFor(() =>
          delay(1000).then(() => `async ${name}`)
        );

        return <span>awaited name: {awaitedName}</span>;
      });

      const output = renderComponentWithMultipleProps(SagaComponent)
        .withProps({ name: 'Matan' })
        .withProps({ name: 'Roy' })
        .render();

      await delay(2000);

      expect(output.container.innerHTML).toEqual(
        '<span>awaited name: async Roy</span>'
      );
    });

    it('should allow caching yielded promises results by a list of dependencies', async () => {
      const yieldedPromise = jest.fn().mockResolvedValue('ok');

      const SagaComponent = createSagaComponent(function* ({
        name,
      }: {
        name: string;
      }) {
        const result: string = yield awaitFor(yieldedPromise, {
          cacheBy: [],
        });

        return (
          <span>
            name: {name}. promise result: {result}
          </span>
        );
      });

      const output = renderComponentWithMultipleProps(SagaComponent)
        .withProps({ name: 'Matan' })
        .withProps({ name: 'Roy' })
        .render();

      await delay(2000);

      expect(output.container.innerHTML).toEqual(
        '<span>name: Roy. promise result: ok</span>'
      );
      expect(yieldedPromise).toHaveBeenCalledTimes(1);
    });
  });

  describe('Yielding Renders', () => {
    it('should let Saga Components yield renders', async () => {
      const SagaComponent = createSagaComponent(function* () {
        yield render(<span>loading...</span>);
        yield awaitFor(() => delay(1000));
        return <span>awaited!</span>;
      });

      const output = renderComponent(<SagaComponent />);
      expect(output.container.innerHTML).toEqual('<span>loading...</span>');

      await act(() => delay(1000));
      expect(output.container.innerHTML).toEqual('<span>awaited!</span>');
    });

    it('should only render once with the latest value in case of multiple subsequent render yields', () => {
      const SagaComponent = createSagaComponent(function* () {
        yield render(<span>1</span>);
        yield render(<span>2</span>);
        yield render(<span>3</span>);
        return <span>last!</span>;
      });

      const output = renderComponent(<SagaComponent />);
      expect(output.container.innerHTML).toEqual('<span>last!</span>');
    });
  });

  describe('Yielding State', () => {
    it('should return the default state by default', () => {
      const SagaComponent = createSagaComponent(function* () {
        const [name, setName]: State<string> = yield useState('Roy');
        return <span>Your name is {name}</span>;
      });

      const output = renderComponent(<SagaComponent />);

      expect(output.container.innerHTML).toEqual(
        '<span>Your name is Roy</span>'
      );
    });

    it('should allow setting value into the state', async () => {
      const SagaComponent = createSagaComponent(function* () {
        const [name, setName]: State<string> = yield useState('Roy');
        return (
          <>
            <span data-testid="text">Your name is {name}</span>
            <button data-testid="button" onClick={() => setName('Matan')}>
              Change it to Matan
            </button>
          </>
        );
      });

      const output = renderComponent(<SagaComponent />);

      await act(() => fireEvent.click(output.getByTestId('button')));

      expect(output.getByTestId('text').textContent).toEqual(
        'Your name is Matan'
      );
    });

    it('should not rerun any yielded promise that comes before the state', async () => {
      const yieldedPromise = jest.fn().mockResolvedValue('ok');
      const SagaComponent = createSagaComponent(function* () {
        const promiseValue: string = yield awaitFor(yieldedPromise);
        const [name, setName]: State<string> = yield useState('Roy');
        return (
          <>
            <span data-testid="text">
              Your name is {name}. Yielded value is {promiseValue}
            </span>
            <button data-testid="button" onClick={() => setName('Matan')}>
              Change it to Matan
            </button>
          </>
        );
      });

      const output = renderComponent(<SagaComponent />);

      await output.findByTestId('button');
      await act(() => fireEvent.click(output.getByTestId('button')));

      await waitFor(() => {
        expect(output.getByTestId('text').textContent).toEqual(
          'Your name is Matan. Yielded value is ok'
        );
        expect(yieldedPromise).toHaveBeenCalledTimes(1);
      });
    });

    it('should rerun yielded promises that come after the state', async () => {
      const yieldedPromise = jest.fn().mockResolvedValue('ok');
      const SagaComponent = createSagaComponent(function* () {
        const [name, setName]: State<string> = yield useState('Roy');
        const promiseValue: string = yield awaitFor(yieldedPromise);
        return (
          <>
            <span data-testid="text">
              Your name is {name}. Yielded value is {promiseValue}
            </span>
            <button data-testid="button" onClick={() => setName('Matan')}>
              Change it to Matan
            </button>
          </>
        );
      });

      const output = renderComponent(<SagaComponent />);

      await output.findByTestId('button');
      await act(() => fireEvent.click(output.getByTestId('button')));

      await waitFor(() => {
        expect(output.getByTestId('text').textContent).toEqual(
          'Your name is Matan. Yielded value is ok'
        );
        expect(yieldedPromise).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Yielding Computations', () => {
    it('should let you perform computations using the "compute" yieldable', () => {
      const SagaComponent = createSagaComponent(function* () {
        const sum: number = yield compute(() => 2 + 2, []);
        return <span>The sum is: {sum}</span>;
      });

      const output = renderComponent(<SagaComponent />);

      expect(output.container.innerHTML).toEqual('<span>The sum is: 4</span>');
    });

    it('should not run the same computation twice by default', async () => {
      const sumFn = jest.fn().mockReturnValue(2 + 2);

      const SagaComponent = createSagaComponent(function* ({
        name,
      }: {
        name: string;
      }) {
        const sum: number = yield compute(() => sumFn(), []);
        return (
          <span>
            Your name is {name} and the sum is: {sum}
          </span>
        );
      });

      const output = renderComponentWithMultipleProps(SagaComponent)
        .withProps({ name: 'Roy' })
        .withProps({ name: 'Matan' })
        .render();

      await act(() => delay(1000));

      expect(output.container.innerHTML).toEqual(
        '<span>Your name is Matan and the sum is: 4</span>'
      );
      expect(sumFn).toHaveBeenCalledTimes(1);
    });

    it('should rerun the same computation if the dependencies list has changed', async () => {
      const SagaComponent = createSagaComponent(function* ({
        name,
      }: {
        name: string;
      }) {
        const superName: string = yield compute(() => `Super ${name}`, [name]);
        return <span>Your super name is {superName}</span>;
      });

      const output = renderComponentWithMultipleProps(SagaComponent)
        .withProps({ name: 'Roy' })
        .withProps({ name: 'Matan' })
        .render();

      await act(() => delay(1000));

      expect(output.container.innerHTML).toEqual(
        '<span>Your super name is Super Matan</span>'
      );
    });
  });
});
