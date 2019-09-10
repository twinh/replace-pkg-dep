import * as fs from 'fs';
import * as util from 'util';

export default async function (dir: string = null) {
  const fileName = (dir || process.cwd()) + '/' + 'package.json';
  const config = require(fileName);

  for (const dependency in config.ciDependencies) {
    if (!config.ciDependencies.hasOwnProperty(dependency)) {
      continue;
    }

    if (typeof config.dependencies[dependency] !== 'undefined') {
      config.dependencies[dependency] = config.ciDependencies[dependency];
      continue;
    }
    config.devDependencies[dependency] = config.ciDependencies[dependency];
  }

  const content = JSON.stringify(config, null, 2);
  return await util.promisify(fs.writeFile)(fileName, content);
}
