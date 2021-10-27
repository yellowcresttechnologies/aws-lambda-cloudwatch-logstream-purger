/**
 * Copyright © 2020 YellowCrest Technologies
 */
const log = require('lambda-log');
const { purge } = require('./src/logStreams');

module.exports.purgeLogSteams = async () => {
  // Query AWS and purge aging empty log streams
  const { purgeErr, logStreamsPurged } = await purge();
  if (purgeErr) log.error(purgeErr);

  const result = `Number of log streams purged: ${logStreamsPurged}`;
  log.info(result);

  return { result, purgeErr };
};
