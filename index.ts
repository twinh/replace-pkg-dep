import * as fs from 'fs';
import * as util from 'util';
import * as path from 'path';
import git from 'git-cli-wrapper';
import log from '@gitsync/log';
import * as Octokit from '@octokit/rest';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

function getGithubBranch() {
  if (!process.env.GITHUB_REF) {
    return null;
  }
  // refs/heads/feature/xxx => feature/xxx
  return process.env.GITHUB_REF.substr(process.env.GITHUB_REF.split('/', 2).join().length + 1);
}

async function getBranch(dir: string) {
  return process.env.TRAVIS_PULL_REQUEST_BRANCH ||
    process.env.TRAVIS_BRANCH ||
    getGithubBranch() ||
    (await git(dir).getBranch());
}

async function replacePackage(dir: string = '', branch = '') {
  const fileName = path.join(dir, 'package.json');
  if (!fs.existsSync(fileName)) {
    return;
  }

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
    branch = await getBranch(dir);
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
          branch,
          owner,
          repo,
        });
        if (status === 200) {
          replaceDependencies[name] += `#${branch}`;
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

async function replaceComposer(dir: string = '', branch: string = '') {
  const fileName = path.join(dir, 'composer.json');
  if (!fs.existsSync(fileName)) {
    return;
  }

  const config = JSON.parse(await util.promisify(fs.readFile)(fileName, 'UTF-8'));
  const replaceKey = 'require-ci';

  if (typeof config.extra === 'undefined' || typeof config.extra[replaceKey] === 'undefined') {
    return;
  }
  const replaceDependencies = config.extra[replaceKey];

  if (typeof config.repositories === 'undefined') {
    config.repositories = [];
  }

  if (!branch) {
    branch = await getBranch(dir);
  }
  log.info(`current branch is "${branch}"`);

  for (const name in replaceDependencies) {
    if (!replaceDependencies.hasOwnProperty(name)) {
      continue;
    }
    config.repositories.push({
      type: 'git',
      url: 'https://github.com/' + replaceDependencies[name] + '.git'
    });
  }

  for (const name in replaceDependencies) {
    if (!replaceDependencies.hasOwnProperty(name)) {
      continue;
    }

    if (branch !== 'master') {
      const [owner, repo] = replaceDependencies[name].split('/');
      try {
        const {status} = await octokit.repos.getBranch({
          branch,
          owner,
          repo,
        });
        if (status === 200) {
          replaceDependencies[name] = `dev-${branch}`;
          log.info(`update dependency "${name}"`);
        }
      } catch (e) {
        log.info(e);
        replaceDependencies[name] = 'dev-master';
      }
    } else {
      replaceDependencies[name] = 'dev-master';
    }
  }

  // Packages may not have been published, replace to avoid install returns not found error
  if (typeof config.require === 'undefined') {
    config.require = {};
  }

  if (typeof config['require-dev'] === 'undefined') {
    config['require-dev'] = {};
  }

  for (const dependency in replaceDependencies) {
    if (!replaceDependencies.hasOwnProperty(dependency)) {
      continue;
    }

    if (config.require && typeof config.require[dependency] !== 'undefined') {
      config.require[dependency] = replaceDependencies[dependency];
      continue;
    }

    if (config['require-dev'] && typeof config['require-dev'][dependency] !== 'undefined') {
      config['require-dev'][dependency] = replaceDependencies[dependency];
    }
  }

  log.info('replaced to:', config);
  const content = JSON.stringify(config, null, 4);
  return await util.promisify(fs.writeFile)(fileName, content);
}

export default async function (dir: string = '', branch = '', file: string = null) {
  if (!dir) {
    dir = process.cwd();
  }

  if (!file || file === 'package.json') {
    await replacePackage(dir, branch);
  }

  if (!file || file === 'composer.json') {
    await replaceComposer(dir, branch);
  }
}
