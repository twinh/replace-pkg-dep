import * as fs from 'fs';
import replacePkgDep from '..';

beforeAll(() => {
  fs.copyFileSync(__dirname + '/test-package.json', __dirname + '/package.json');
});

afterAll(() => {
  fs.unlinkSync(__dirname + '/package.json');
});

describe('replace-pkg-dep', () => {
  it('run', async () => {
    await replacePkgDep(__dirname);

    const config = require(__dirname + '/package.json');

    expect(config.dependencies).toEqual({
      "test": "user/test#master",
      "test2": "^0.1.0"
    });

    expect(config.devDependencies).toEqual({
      "test3": "user/test3#branch"
    });
  });
});
