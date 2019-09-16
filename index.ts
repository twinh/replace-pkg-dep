import * as fs from 'fs';
import * as util from 'util';
import * as path from 'path';
import git from 'git-cli-wrapper';
import log from '@gitsync/log';
import githubBranches from 'github-branches';

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

  const branch = process.env.TRAVIS_PULL_REQUEST_BRANCH
    || process.env.TRAVIS_BRANCH
    || await git(dir).getBranch();
  log.info(`current branch is "${branch}"`);

  if (branch !== 'master') {
    for (const name in replaceDependencies) {
      if (!replaceDependencies.hasOwnProperty(name)) {
        continue;
      }

      const branches = await githubBranches(replaceDependencies[name]);
      for (const branchInfo of branches) {
        if (branchInfo.name === branch) {
          replaceDependencies[name] += '#' + branch;
          log.info(`update dependency "${name}"`);
          break;
        }
      }
    }
  }

  Object.assign(config.resolutions, replaceDependencies);

  // Packages may not have been published, replace to avoid yarn install returns not found error
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

  log.info('replaced to:', config);
  const content = JSON.stringify(config, null, 2);
  return await util.promisify(fs.writeFile)(fileName, content);
}
