import { ComponentType, useEffect, useState } from 'react';
import * as tlr from '@testing-library/react';

export const renderComponent = tlr.render;

export function renderComponentWithMultipleProps<TProps extends {}>(
  Component: ComponentType<TProps>
) {
  const propsList: TProps[] = [];

  function RenderWithAllProps() {
    const [propsIndex, setPropsIndex] = useState(0);

    useEffect(() => {
      setTimeout(() => {
        if (propsIndex < propsList.length - 1) {
          setPropsIndex(propsIndex + 1);
        }
      }, 500);
    }, [propsIndex]);

    return <Component {...propsList[propsIndex]} />;
  }

  function withProps(props: TProps) {
    propsList.push(props);

    return {
      withProps,
      render,
    };
  }

  function render() {
    return tlr.render(<RenderWithAllProps />);
  }

  return {
    withProps,
  };
}
