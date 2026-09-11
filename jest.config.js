module.exports = {
  testTimeout: 30000, // 30 second timeout for integration tests
  testEnvironment: 'node',
  collectCoverageFrom: [
    'lambdas/**/*.js',
    '!lambdas/**/node_modules/**',
    '!lambdas/**/tests/**'
  ],
  testMatch: [
    '**/tests/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ]
};
