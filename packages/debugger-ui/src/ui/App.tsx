import React from 'react';
import Runtime from './runtime';

const App = () => {
  React.useEffect(() => {
    new Runtime({onEvent: (...messages) => console.log('zzz', ...messages)});
  }, []);

  return (
    <main>
      <div>App</div>
    </main>
  );
};

export default App;
