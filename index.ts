import * as fs from 'fs';
import * as util from 'util';

export default async function (dir: string = null) {
  const fileName = (dir || process.cwd()) + '/' + 'package.json';
  const config = JSON.parse(await util.promisify(fs.readFile)(fileName, 'UTF-8'));
  const replaceKey = 'ciDependencies';

  if (typeof config[replaceKey] === 'undefined') {
    return;
  }
  const replaceDependencies = config[replaceKey];

  if (typeof config.dependencies === 'undefined') {
    config.dependencies = {};
  }

  if (typeof config.devDependencies === 'undefined') {
    config.devDependencies = {};
  }

  for (const dependency in replaceDependencies) {
    if (!replaceDependencies.hasOwnProperty(dependency)) {
      continue;
    }

    if (config.dependencies && typeof config.dependencies[dependency] !== 'undefined') {
      config.dependencies[dependency] = replaceDependencies[dependency];
      continue;
    }

    config.devDependencies[dependency] = replaceDependencies[dependency];
  }

  const content = JSON.stringify(config, null, 2);
  return await util.promisify(fs.writeFile)(fileName, content);
}
