import * as fs from 'fs';
import replacePkgDep from '..';
import * as util from "util";

const packageFile = __dirname + '/package.json';

async function writePackage(config: {}) {
  return await util.promisify(fs.writeFile)(packageFile, JSON.stringify(config));
}

async function unlinkPackage() {
  if (await fs.existsSync(packageFile)) {
    return await util.promisify(fs.unlink)(packageFile);
  }
}

async function getConfig() {
  return JSON.parse(await util.promisify(fs.readFile)(packageFile, 'UTF-8'));
}

afterAll(async () => {
  return await unlinkPackage();
});

describe('replace-pkg-dep', () => {
  test('replace dependencies', async () => {
    await writePackage({
      "dependencies": {
        "test": "^0.1.0",
        "test2": "^0.1.0"
      },
      "devDependencies": {
        "test3": "^0.1.0"
      },
      "ciDependencies": {
        "test": "user/test#master",
        "test3": "user/test3#branch"
      }
    });
    await replacePkgDep(__dirname);

    const config = await getConfig();

    expect(config.dependencies).toEqual({
      "test": "user/test#master",
      "test2": "^0.1.0"
    });

    expect(config.devDependencies).toEqual({
      "test3": "user/test3#branch"
    });
  });

  test('ciDependencies key not in package.json', async () => {
    await writePackage({});
    await replacePkgDep(__dirname);

    const config = await getConfig();

    expect(config).toEqual({});
  });

  test('dependencies key not in package.json', async () => {
    await writePackage({
      "devDependencies": {
        "test3": "^0.1.0"
      },
      "ciDependencies": {
        "test": "user/test#master",
        "test3": "user/test3#branch"
      }
    });
    await replacePkgDep(__dirname);

    const config = await getConfig();

    expect(config.dependencies).toEqual({});

    expect(config.devDependencies).toEqual({
      "test": "user/test#master",
      "test3": "user/test3#branch"
    });
  });

  test('devDependencies key not in package.json', async () => {
    await writePackage({
      "ciDependencies": {
        "test": "user/test#master",
        "test3": "user/test3#branch"
      }
    });
    await replacePkgDep(__dirname);

    const config = await getConfig();

    expect(config.dependencies).toEqual({});

    expect(config.devDependencies).toEqual({
      "test": "user/test#master",
      "test3": "user/test3#branch"
    });
  });
});

