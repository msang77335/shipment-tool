/* eslint-disable @typescript-eslint/no-var-requires */
const sonarqubeScanner = require("sonarqube-scanner");
sonarqubeScanner({
  serverUrl: "https://dev-sonarqube.neopay.vn/",
  options: {
    "sonar.sources": ".",
    "sonar.tests": ".",
    "sonar.inclusions": "**", // Entry point of your code
    "sonar.test.inclusions": "**/*.test.ts",
    "sonar.javascript.lcov.reportPaths": "coverage/lcov.info",
    "sonar.testExecutionReportPaths": "coverage/test-reporter.xml",
    "sonar.login": process.env.SONAR_LOGIN,
  },
});
