export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    "^.+\\.js$": "babel-jest",
    "^.+\\.ts$": ["ts-jest", {
      useESM: true
    }]
  },
  transformIgnorePatterns: [
    "/node_modules/(?!(node-fetch)/)"
  ]
};