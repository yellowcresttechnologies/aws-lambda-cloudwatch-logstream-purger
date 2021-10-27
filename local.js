/**
 * Copyright © 2020 YellowCrest Technologies
 */
const log = require('lambda-log');

/**
 * Helper file for running the log stream purge locally or in a non-lambda environment
 */
const { purge } = require('./src/logStreams');

(async () => {
  const { purgeErr, logStreamsPurged } = await purge();
  if (purgeErr) log.error(purgeErr);
  log.info(`Number of log streams purged: ${logStreamsPurged}`);
})();
