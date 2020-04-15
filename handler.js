/**
 * Copyright © 2020 YellowCrest Technologies
 */
const { purge } = require('./src/logStreams');

module.exports.purgeLogSteams = async () => {
  // Query AWS and purge aging empty log streams
  const { purgeErr, logStreamsPurged } = await purge();
  if (purgeErr) console.error(purgeErr);

  const result = `Number of log streams purged: ${logStreamsPurged}`;
  console.info(result);

  return { result, purgeErr };
};
