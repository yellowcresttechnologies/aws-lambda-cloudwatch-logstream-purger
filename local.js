/**
 * Copyright © 2020 YellowCrest Technologies
 */

/**
 * Helper file for running the log stream purge locally or in a non-lambda environment
 */
const { purge } = require('./src/logStreams');

(async () => {
  const { purgeErr, logStreamsPurged } = await purge();
  if (purgeErr) console.error(purgeErr);
  console.info(`Number of log streams purged: ${logStreamsPurged}`);
})();
