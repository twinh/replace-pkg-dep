import * as fs from 'fs';
import * as util from 'util';
import * as path from 'path';
import git from 'git-cli-wrapper';
import log from '@gitsync/log';
import * as Octokit from '@octokit/rest';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

export default async function (dir: string = process.cwd(), branch: string = '') {
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

  if (!branch) {
    branch = process.env.TRAVIS_PULL_REQUEST_BRANCH
      || process.env.TRAVIS_BRANCH
      || getGithubBranch()
      || await git(dir).getBranch();
  }
  log.info(`current branch is "${branch}"`);

  if (branch !== 'master') {
    for (const name in replaceDependencies) {
      if (!replaceDependencies.hasOwnProperty(name)) {
        continue;
      }

      const [owner, repo] = replaceDependencies[name].split('/');
      try {
        const {status} = await octokit.repos.getBranch({
          branch: branch,
          owner: owner,
          repo: repo,
        });
        if (status === 200) {
          replaceDependencies[name] += '#' + branch;
          log.info(`update dependency "${name}"`);
        }
      } catch (e) {
        log.info(e);
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

function getGithubBranch() {
  if (!process.env.GITHUB_REF) {
    return null;
  }
  // refs/heads/feature/xxx => feature/xxx
  return process.env.GITHUB_REF.substr(process.env.GITHUB_REF.split('/', 2).join().length + 1);
}
