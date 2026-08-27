/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1', // tsconfig.json içindeki @/ yol tanımlaması için
  },
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};