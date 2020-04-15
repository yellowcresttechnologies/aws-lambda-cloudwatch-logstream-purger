/**
 * Copyright © 2020 YellowCrest Technologies
 */
module.exports = {
  env: {
    node: true,
  },
  extends: [
    'airbnb-base',
  ],
  rules: {
    // Use console in lambda
    "no-console": 0,
  },
  settings: {
    // AWS SDK ships with Lambda runtime so we do not package it into lambda. Locally we still install
    // as a dev dependency
    "import/core-modules": [
      "async",
      "aws-sdk/clients/cloudwatchlogs",
    ]
  }
};
