import * as fs from 'fs';
import replacePkgDep from '..';
import * as util from "util";
import {createRepo} from "@gitsync/test";
import Repo from "@gitsync/test/Repo";

async function writePackage(repo: Repo, config: {}) {
  return await util.promisify(fs.writeFile)(repo.getFile('package.json'), JSON.stringify(config));
}

async function getPackage(repo: Repo) {
  return JSON.parse(await util.promisify(fs.readFile)(repo.getFile('package.json'), 'UTF-8'));
}

async function writeComposer(repo: Repo, config: {}) {
  return await util.promisify(fs.writeFile)(repo.getFile('composer.json'), JSON.stringify(config));
}

async function getComposer(repo: Repo) {
  return JSON.parse(await util.promisify(fs.readFile)(repo.getFile('composer.json'), 'UTF-8'));
}

describe('replace-pkg-dep', () => {
  test('package.json: replace dependencies', async () => {
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
    await replacePkgDep(repo.dir, 'master');

    const config = await getPackage(repo);

    expect(config.resolutions).toEqual({
      "test2": "^0.1.0",
      "test": "user/test",
      "test3": "user/test3#branch"
    });
  });

  test('package.json: ciDependencies key', async () => {
    const repo = await createRepo();

    await writePackage(repo, {});
    await replacePkgDep(repo.dir);

    const config = await getPackage(repo);

    expect(config).toEqual({});
  });

  test('package.json: resolutions key not found', async () => {
    const repo = await createRepo();

    await writePackage(repo, {
      "ciDependencies": {
        "test": "user/test",
        "test3": "user/test3#branch"
      }
    });
    await replacePkgDep(repo.dir, 'master');

    const config = await getPackage(repo);

    expect(config.resolutions).toEqual({
      "test": "user/test",
      "test3": "user/test3#branch"
    });
  });

  test('package.json: custom branch', async () => {
    const repo = await createRepo();

    await writePackage(repo, {
      "ciDependencies": {
        "replace-pkg-dep": "twinh/replace-pkg-dep",
      }
    });
    await replacePkgDep(repo.dir, 'test');

    const config = await getPackage(repo);

    expect(config.resolutions).toEqual({
      "replace-pkg-dep": "twinh/replace-pkg-dep#test",
    });
  });

  test('package.json: branch not found', async () => {
    const repo = await createRepo();
    await repo.run(['checkout', '-b', 'not-found']);

    await writePackage(repo, {
      "ciDependencies": {
        "replace-pkg-dep": "twinh/replace-pkg-dep",
      }
    });
    await replacePkgDep(repo.dir, 'not-found');

    const config = await getPackage(repo);

    expect(config.resolutions).toEqual({
      "replace-pkg-dep": "twinh/replace-pkg-dep",
    });
  });

  test('package.json: only package.json', async () => {
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
    await writeComposer(repo, {
      "require": {
        "test/test": "^1.0.0",
        "test/test3": "^1.2.0",
      },
      "extra": {
        "require-ci": {
          "test/test": "my-test/test",
          "test/test3": "my-test/test3"
        }
      }
    });

    await replacePkgDep(repo.dir, 'master', 'package.json');

    const config = await getPackage(repo);
    expect(config.resolutions).toEqual({
      "test2": "^0.1.0",
      "test": "user/test",
      "test3": "user/test3#branch"
    });

    const config2 = await getComposer(repo);
    expect(config2.require).toEqual({
      "test/test": "^1.0.0",
      "test/test3": "^1.2.0",
    });
  });

  test('composer.json: replace dependencies', async () => {
    const repo = await createRepo();

    await writeComposer(repo, {
      "require": {
        "test/test": "^1.0.0",
        "test/test3": "^1.2.0",
      },
      "extra": {
        "require-ci": {
          "test/test": "my-test/test",
          "test/test3": "my-test/test3"
        }
      }
    });
    await replacePkgDep(repo.dir, 'master');

    const config = await getComposer(repo);

    expect(config.require).toEqual({
      "test/test": "dev-master",
      "test/test3": "dev-master",
    });

    expect(config['require-dev']).toEqual({});

    expect(config.repositories).toEqual([
      {
        "type": "git",
        "url": "https://github.com/my-test/test.git"
      },
      {
        "type": "git",
        "url": "https://github.com/my-test/test3.git"
      }
    ]);
  });

  test('composer.json: replace dev dependencies', async () => {
    const repo = await createRepo();

    await writeComposer(repo, {
      "require": {
        "test/test": "^1.0.0",
      },
      "require-dev": {
        "test/test3": "^1.0.0",
      },
      "extra": {
        "require-ci": {
          "test/test": "my-test/test",
          "test/test3": "my-test/test3"
        }
      }
    });
    await replacePkgDep(repo.dir, 'master');

    const config = await getComposer(repo);

    expect(config.require).toEqual({
      "test/test": "dev-master",
    });

    expect(config['require-dev']).toEqual({
      "test/test3": "dev-master",
    });

    expect(config.repositories).toEqual([
      {
        "type": "git",
        "url": "https://github.com/my-test/test.git"
      },
      {
        "type": "git",
        "url": "https://github.com/my-test/test3.git"
      }
    ]);
  });

  test('composer.json: require-ci key not found', async () => {
    const repo = await createRepo();

    await writeComposer(repo, {});
    await replacePkgDep(repo.dir);

    const config = await getComposer(repo);

    expect(config).toEqual({});
  });

  test('composer.json: repositories key not found', async () => {
    const repo = await createRepo();

    await writeComposer(repo, {
      extra: {
        "require-ci": {
          "test/test": "my-test/test",
          "test/test3": "my-test/test3"
        }
      }
    });
    await replacePkgDep(repo.dir, 'master');

    const config = await getComposer(repo);

    expect(config.require).toEqual({});

    expect(config['require-dev']).toEqual({
      "test/test": "dev-master",
      "test/test3": "dev-master"
    });

    expect(config.repositories).toEqual([
      {
        "type": "git",
        "url": "https://github.com/my-test/test.git"
      },
      {
        "type": "git",
        "url": "https://github.com/my-test/test3.git"
      }
    ]);
  });

  test('composer.json: custom branch', async () => {
    const repo = await createRepo();

    await writeComposer(repo, {
      require: {
        "replace-pkg-dep/replace-pkg-dep": "^1.0.0",
      },
      extra: {
        "require-ci": {
          "replace-pkg-dep/replace-pkg-dep": "twinh/replace-pkg-dep",
        }
      },
    });
    await replacePkgDep(repo.dir, 'test');

    const config = await getComposer(repo);

    expect(config.require).toEqual({
      "replace-pkg-dep/replace-pkg-dep": 'dev-test',
    });

    expect(config['require-dev']).toEqual({});

    expect(config.repositories).toEqual([
      {
        "type": "git",
        "url": "https://github.com/twinh/replace-pkg-dep.git"
      }
    ]);
  });

  test('composer.json: branch not found', async () => {
    const repo = await createRepo();
    await repo.run(['checkout', '-b', 'not-found']);

    await writeComposer(repo, {
      require: {
        "replace-pkg-dep/replace-pkg-dep": "^1.0.0",
      },
      extra: {
        "require-ci": {
          "replace-pkg-dep/replace-pkg-dep": "twinh/replace-pkg-dep",
        }
      }
    });
    await replacePkgDep(repo.dir, 'not-found');

    const config = await getComposer(repo);

    expect(config.require).toEqual({
      "replace-pkg-dep/replace-pkg-dep": 'dev-master',
    });

    expect(config['require-dev']).toEqual({});

    expect(config.repositories).toEqual([
      {
        "type": "git",
        "url": "https://github.com/twinh/replace-pkg-dep.git"
      }
    ]);
  });

  test('composer.json: only composer.json', async () => {
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
    await writeComposer(repo, {
      "require": {
        "test/test": "^1.0.0",
        "test/test3": "^1.2.0",
      },
      "extra": {
        "require-ci": {
          "test/test": "my-test/test",
          "test/test3": "my-test/test3"
        }
      }
    });

    await replacePkgDep(repo.dir, 'master', 'composer.json');

    const config = await getPackage(repo);
    expect(config.resolutions).toEqual({
      "test2": "^0.1.0"
    });

    const config2 = await getComposer(repo);
    expect(config2.require).toEqual({
      "test/test": "dev-master",
      "test/test3": "dev-master",
    });
  });
});

