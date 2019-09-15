import * as fs from 'fs';
import * as util from 'util';
import * as path from 'path';
import git from 'git-cli-wrapper';
import * as githubBranches from 'github-branches';

export default async function (dir: string = process.cwd()) {
  const fileName = path.join(dir, 'package.json');
  const config = JSON.parse(await util.promisify(fs.readFile)(fileName, 'UTF-8'));
  const replaceKey = 'ciDependencies';

  if (typeof config[replaceKey] === 'undefined') {
    return;
  }
  const replaceDependencies = config[replaceKey];

  if (typeof config.resolutions === 'undefined') {
    config.resolutions = {};
  }

  const repo = git(dir);
  const branch = await repo.getBranch();
  if (branch !== 'master') {
    for (const name in replaceDependencies) {
      if (!replaceDependencies.hasOwnProperty(name)) {
        continue;
      }

      const branches = await githubBranches(replaceDependencies[name]);
      for (const branchInfo of branches) {
        if (branchInfo.name === branch) {
          replaceDependencies[name] += '#' + branch;
          break;
        }
      }
    }
  }

  Object.assign(config.resolutions, replaceDependencies);

  const content = JSON.stringify(config, null, 2);
  return await util.promisify(fs.writeFile)(fileName, content);
}
