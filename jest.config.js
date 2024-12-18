module.exports = {
  roots: ["<rootDir>"],
  // Xác định nơi bỏ các file testing
  // Thông thuòng ra sẽ bỏ các file typescript vào hết thư mục src
  testMatch: ["**/?(*.)+(spec|test).+(ts|tsx|js)"],
  // Jest sẽ dựa định dạng này để phát hiện các file
  // Cần được testing nhé
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest",
  },
  // Thằng ts-jest sẽ xác định các file có dạng này
  // Sau đó sẽ biến đổi về dạng nó có thể hiểu được
  // Để chạy jest
  verbose: true,
  testEnvironment: "node",
  // setupFilesAfterEnv: ["./__tests__/setup.ts"],
  testPathIgnorePatterns: ["<rootDir>/dist/"],
  modulePathIgnorePatterns: ["<rootDir>/dist/"],
  coveragePathIgnorePatterns: ["/node_modules/"],
  testResultsProcessor: "jest-sonar-reporter",
};
