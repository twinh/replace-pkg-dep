#!/usr/bin/env node

import replacePkgDep from './index';

(async () => {
  await replacePkgDep('', '', process.argv[2]);
})();
