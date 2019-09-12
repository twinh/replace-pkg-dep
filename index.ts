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

  if (typeof config.resolutions === 'undefined') {
    config.resolutions = {};
  }
  Object.assign(config.resolutions, replaceDependencies);

  const content = JSON.stringify(config, null, 2);
  return await util.promisify(fs.writeFile)(fileName, content);
}
