import * as fs from 'fs';
import replacePkgDep from '..';
import * as util from "util";
import {createRepo} from "@gitsync/test";
import Repo from "@gitsync/test/Repo";

async function writePackage(repo: Repo, config: {}) {
  return await util.promisify(fs.writeFile)(repo.getFile('package.json'), JSON.stringify(config));
}

async function getConfig(repo: Repo) {
  return JSON.parse(await util.promisify(fs.readFile)(repo.getFile('package.json'), 'UTF-8'));
}

describe('replace-pkg-dep', () => {
  test('replace dependencies', async () => {
    const repo = await createRepo();

    await writePackage(repo, {
      "resolutions": {
        "test2": "^0.1.0"
      },
      "ciDependencies": {
        "test": "user/test",
        "test3": "user/test3#branch"
      }
    });
    await replacePkgDep(repo.dir);

    const config = await getConfig(repo);

    expect(config.resolutions).toEqual({
      "test2": "^0.1.0",
      "test": "user/test",
      "test3": "user/test3#branch"
    });
  });

  test('ciDependencies key not in package.json', async () => {
    const repo = await createRepo();

    await writePackage(repo, {});
    await replacePkgDep(repo.dir);

    const config = await getConfig(repo);

    expect(config).toEqual({});
  });

  test('resolutions key not in package.json', async () => {
    const repo = await createRepo();

    await writePackage(repo, {
      "ciDependencies": {
        "test": "user/test",
        "test3": "user/test3#branch"
      }
    });
    await replacePkgDep(repo.dir);

    const config = await getConfig(repo);

    expect(config.resolutions).toEqual({
      "test": "user/test",
      "test3": "user/test3#branch"
    });
  });

  test('custom branch', async () => {
    const repo = await createRepo();
    await repo.run(['checkout', '-b', 'test']);

    await writePackage(repo, {
      "ciDependencies": {
        "replace-pkg-dep": "twinh/replace-pkg-dep",
      }
    });
    await replacePkgDep(repo.dir);

    const config = await getConfig(repo);

    expect(config.resolutions).toEqual({
      "replace-pkg-dep": "twinh/replace-pkg-dep#test",
    });
  });

  test('branch not found', async () => {
    const repo = await createRepo();
    await repo.run(['checkout', '-b', 'not-found']);

    await writePackage(repo, {
      "ciDependencies": {
        "replace-pkg-dep": "twinh/replace-pkg-dep",
      }
    });
    await replacePkgDep(repo.dir);

    const config = await getConfig(repo);

    expect(config.resolutions).toEqual({
      "replace-pkg-dep": "twinh/replace-pkg-dep",
    });
  });
});

