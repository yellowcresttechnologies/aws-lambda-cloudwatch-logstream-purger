/**
 * Copyright © 2020 YellowCrest Technologies
 */
const async = require('async');
const CloudWatchLogsClient = require('aws-sdk/clients/cloudwatchlogs');

/**
 * Disabling no-await-in-loop as AWS calls paginate with nextToken. Can not
 * make subsequent call without knowing token from first call
 */
/* eslint-disable no-await-in-loop */

const CloudWatchLogs = new CloudWatchLogsClient();

// Default limits for querying AWS resources
const LOG_GROUP_GET_LIMIT = 50;
const LOG_GROUP_EACH_LIMIT = 5;
const LOG_STREAM_GET_LIMIT = 50;

// Age of empty log streams to purge in milliseconds
const PURGE_AGE_MS = 1209600000; // 14 Days

// AWS Throttling Delay in milliseconds
const AWS_DELAY = 1000;

// Flags to show verbose purge and retain logs
const SHOW_PURGE_LOGS = true;
const SHOW_RETAIN_LOGS = false;

// Counter for tracking how many log streams get purged
let logStreamsPurged = 0;

/**
 * Queries AWS for CloudWatch Log Groups
 *
 * @param {string} [nextToken]
 */
async function describeLogGroups(nextToken = null) {
  const logGroupParams = {
    limit: LOG_GROUP_GET_LIMIT,
  };

  if (nextToken) logGroupParams.nextToken = nextToken;

  return CloudWatchLogs.describeLogGroups(logGroupParams).promise()
    .then((logGroups) => ({ logGroupsErr: null, logGroups }))
    .catch((err) => {
      const logGroupsErr = `ERROR describing log groups: ${err}`;
      return { logGroupsErr, logGroups: null };
    });
}

/**
 * Queries AWS for CloudWatch Log Streams within a Log Group
 *
 * @param {string} logGroupName
 * @param {string} [nextToken]
 */
async function describeLogStreams(logGroupName, nextToken = null) {
  const logStreamParams = {
    logGroupName,
    limit: LOG_STREAM_GET_LIMIT,
  };

  if (nextToken) logStreamParams.nextToken = nextToken;

  return CloudWatchLogs.describeLogStreams(logStreamParams).promise()
    .then((logStreams) => ({ logStreamsErr: null, logStreams }))
    .catch((err) => {
      const logStreamsErr = `ERROR describing log streams: ${err}`;
      return { logStreamsErr, logStreams: null };
    });
}

/**
 * Deletes a given log stream and log group
 *
 * @param {string} logGroupName
 * @param {string} logStreamName
 */
async function deleteLogStream(logGroupName, logStreamName) {
  const logStreamParams = {
    logGroupName,
    logStreamName,
  };

  return CloudWatchLogs.deleteLogStream(logStreamParams).promise()
    // .then(() => ({ logStreamsDelErr: null }))
    .then(() => {
      // Add to the counter
      logStreamsPurged += 1;

      return { logStreamsDelErr: null };
    })
    .catch((err) => {
      const logStreamsDelErr = `ERROR deleting log stream ${logGroupName} ${logStreamName}: ${err}`;
      return { logStreamsDelErr };
    });
}

/**
 * Iterates until all log groups are returned
 */
async function getAllLogGroups() {
  let hasMoreLogGroups = true;
  let nextToken;

  // Merge all returned log groups into one array
  const allLogGroups = [];

  // Iterate until all log groups are returned
  while (hasMoreLogGroups) {
    // Query AWS for all log groups
    const { logGroupsErr, logGroups } = await describeLogGroups(nextToken);

    // Return on error
    if (logGroupsErr) return { getAllLogGroupsErr: logGroupsErr, allLogGroups: null };

    // If there is a nextToken, we will query AWS again
    if (logGroups.nextToken) nextToken = logGroups.nextToken;
    if (!logGroups.nextToken) hasMoreLogGroups = false;

    // If log groups were returned, merge into the all groups array
    if (logGroups.logGroups && logGroups.logGroups.length) {
      allLogGroups.push(...logGroups.logGroups);
    }
  }

  // Return the log groups
  return { getAllLogGroupsErr: null, allLogGroups };
}

/**
 * Inspects the log stream to make a decision on whether to purge it or not
 *
 * @param {object} logStream
 * @param {number} logStream.storedBytes
 * @param {number} logStream.lastEventTimestamp
 * @return {boolean}
 */
function isPurgable(logStream = {}) {
  let doPurge = false;

  // Streams must be empty to purge
  if (logStream.storedBytes === 0) {
    // If the timestamp on the last event is older than 14 days old, then purge
    // If last event timestamp is undefined, check creationTime
    const timeToCheck = logStream.lastEventTimestamp || logStream.creationTime;
    if ((Date.now() - timeToCheck) > PURGE_AGE_MS) doPurge = true;
  }

  return doPurge;
}

/**
 * Adds a delay to prevent AWS Throttling
 *
 * @param {number} delay in milliseconds
 */
async function addDelay(delay) {
  return new Promise((res) => { setTimeout(res, delay); });
}

/**
 * For a given log group, queries all log streams and purges any stream that
 * is empty and older than are allowed threshold
 *
 * @param {string} logGroupName
 */
async function processLogGroup(logGroupName) {
  let hasMoreLogStreams = true;
  let nextToken;

  // Iterate until all log streams are returned
  while (hasMoreLogStreams) {
    // Query AWS for all log streams for this log group
    const { logStreamsErr, logStreams } = await describeLogStreams(logGroupName, nextToken);

    // Return on error
    if (logStreamsErr) return { processLogGroupErr: logStreamsErr };

    logStreams.logStreams.forEach(async (logStream) => {
      // Check if we can purge the log
      if (isPurgable(logStream)) {
        // Purge it!
        if (SHOW_PURGE_LOGS) {
          console.info(`Purging ${logGroupName} ${logStream.logStreamName}`);
        }

        const { logStreamsDelErr } = await deleteLogStream(logGroupName, logStream.logStreamName);

        // Return on error
        if (logStreamsDelErr) return { processLogGroupErr: logStreamsDelErr };
      } else if (SHOW_RETAIN_LOGS) {
        console.info(`Retaining ${logGroupName} ${logStream.logStreamName} ${logStream.storedBytes}`);
      }

      return null;
    });

    // If there is a nextToken, we will query AWS again
    if (logStreams.nextToken) nextToken = logStreams.nextToken;
    if (!logStreams.nextToken) hasMoreLogStreams = false;

    // AWS will throttle, so add a minor delay
    await addDelay(AWS_DELAY);
  }

  return { processLogGroupErr: null };
}

/**
 * Looks for empty CloudWatch Log streams older than a configured timestamp
 * and delets them
 */
async function purge() {
  // Query AWS for all log groups
  const { getAllLogGroupsErr, allLogGroups } = await getAllLogGroups();

  // Return on error
  if (getAllLogGroupsErr) return { purgeErr: getAllLogGroupsErr, logStreamsPurged };

  if (allLogGroups && allLogGroups.length) {
    let allLogGroupsErr;

    // Process each log group in parallel but limited
    await async.eachLimit(allLogGroups, LOG_GROUP_EACH_LIMIT, async (logGroup) => {
      const { processLogGroupErr } = await processLogGroup(logGroup.logGroupName);

      if (processLogGroupErr) {
        allLogGroupsErr = processLogGroupErr;
        return { purgeErr: allLogGroupsErr, logStreamsPurged };
      }

      return null;
    });

    if (allLogGroupsErr) return { purgeErr: allLogGroupsErr, logStreamsPurged };
  }

  return { purgeErr: null, logStreamsPurged };
}

module.exports = {
  purge,
};
