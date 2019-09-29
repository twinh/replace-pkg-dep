module.exports = {
  transform: {'^.+\\.ts?$': 'ts-jest'},
  testEnvironment: 'node',
  // Allow /node_modules/ for CI testing
  transformIgnorePatterns: [],
  // Fix TypeError: Unable to require `.d.ts` file.
  // https://github.com/kulshekhar/ts-jest/issues/950
  globals: {
    'ts-jest': {
      isolatedModules: true
    },
  },
};
