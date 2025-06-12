import '@testing-library/jest-dom/jest-globals';
import '@testing-library/jest-dom/matchers';

import '@testing-library/jest-dom';

import { cleanup } from '@testing-library/react';

// runs a clean after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
});
