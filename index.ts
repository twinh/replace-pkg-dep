import * as fs from 'fs';
import * as util from 'util';
import * as path from 'path';
import git from 'git-cli-wrapper';
import log from '@gitsync/log';
import {Octokit} from '@octokit/rest';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

interface ReplaceDependency {
  // The name of dependency, like "vendor-name/package-name"
  name: string,
  // The GitHub repo path, like "user/repo"
  repo: string,
  // The composer alias, like "1.1.x-dev"
  alias?: string,
}

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
  const replaceDependencies = {...config[replaceKey]};

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

  const replaceDependencies: ReplaceDependency[] = [];
  for (const name in config.extra[replaceKey]) {
    if (!config.extra[replaceKey].hasOwnProperty(name)) {
      continue;
    }

    const [repo, alias] = config.extra[replaceKey][name].split(' as ');
    replaceDependencies.push({
      name,
      repo,
      alias
    });
  }

  if (typeof config.repositories === 'undefined') {
    config.repositories = [];
  }

  // Packages may not have been published, replace to avoid install returns not found error
  if (typeof config.require === 'undefined') {
    config.require = {};
  }

  if (typeof config['require-dev'] === 'undefined') {
    config['require-dev'] = {};
  }

  if (!branch) {
    branch = await getBranch(dir);
  }
  log.info(`current branch is "${branch}"`);

  for (const replaceDependency of replaceDependencies) {
    // Package may not have been push to packagist
    config.repositories.push({
      type: 'git',
      url: 'https://github.com/' + replaceDependency.repo + '.git'
    });

    // Branch may not exists
    let requireBranch = 'dev-master';
    if (branch !== 'master') {
      const [owner, repo] = replaceDependency.repo.split('/');
      try {
        const {status} = await octokit.repos.getBranch({branch, owner, repo});
        if (status === 200) {
          requireBranch = `dev-${branch}`;
          log.info(`update dependency "${replaceDependency.repo}"`);
        }
      } catch (e) {
        log.info(e);
      }
    }

    const dependency = requireBranch + (replaceDependency.alias ? (' as ' + replaceDependency.alias) : '');

    if (config.require && typeof config.require[replaceDependency.name] !== 'undefined') {
      config.require[replaceDependency.name] = dependency;
      continue;
    }

    // Add the underlying dependencies to require-dev
    config['require-dev'][replaceDependency.name] = dependency;
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
