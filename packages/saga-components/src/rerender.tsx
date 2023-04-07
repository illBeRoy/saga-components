import { useState } from 'react';

export const useRerender = () => {
  const [_, setRandomState] = useState(0);

  function setRandomValueInStateSoItForcesRerender() {
    setRandomState(Math.random());
  }

  return setRandomValueInStateSoItForcesRerender;
};
