# AWS Lambda CloudWatch Log Stream Purger
AWS Lambda function for purging old empty CloudWatch log streams

AWS CloudWatch log groups allow you to set a retention period for purging logs. However, empty log streams can remain for months, leaving you with tens of thousands of empty log streams. While there is no charge incurred for the empty log streams, when using the new AWS CloudWatch console, they can make managing and reviewing logs cumbersome.

The AWS Lambda Cloudwatch Log Stream Purger deploys a lambda function that will run on interval and delete any empty log streams older than a given age.

### Requirements
Log Stream Purger requires the NPM module [Serverless](https://serverless.com/framework/docs/)

```
npm install -g serverless
```

The AWS lambda function runs using the Node.js 12.x runtime engine

### Deploying
Deployment is managed by serverless and will create a lambda function that is run on an interval managed by CloudWatch events. It will also use lambda layers for its 2 dependencies. Using lambda layers ensures the lambda function code is small enough to tweak config settings directly in the console.

To deploy run the included npm script, which will first ensure the dependencies have been installed in the lambda layers directory
```
npm run deploy
```

### Configuration
Within **src/logStreams.js** the following config settings can be changed to accomodate your environment

- `LOG_GROUP_GET_LIMIT`: The number of log groups to query at one time. Defaults to 50.
- `LOG_GROUP_EACH_LIMIT`: The number of log groups to query and delete log steams for in parallel. We had 10000+ empty log streams when first running this purge and run the possibility of getting throttled by AWS. Tweaking this value can help if you get throttled. Defaults to 5.
- `LOG_STREAM_GET_LIMIT`: The number of log streams to query for a given log group at one time. Defaults to 50.
- `PURGE_AGE_MS`: The max age allowed for an empty log stream in milliseconds. Defaults to 14 days.
- `AWS_DELAY`: A delay to add in between processing of a log group in milliseconds. Tweaking this value can help if you get throttled by AWS. Defaults to 1 second
- `SHOW_PURGE_LOGS`: Flag to show which log streams are being purged. If you have a log of log streams this could get very noisy. Defaults to true.
- `SHOW_RETAIN_LOGS`: Flag to show which log streams are being retained. If you have a log of log streams this could get very noisy. Defaults to false.

One note on the lambda function values in **serverless.yml**: We started with over 10,000 log streams and initially ran at the maximum 15 minute timeout for a lambda function. Once purged, 5 minutes nighly is more than sufficient.

### Running locally
You can also run this locally, assuming you have proper permissions to query and delete CloudWatch log streams on your account. To avoid worrying how to call the lambda function properly in a non-lambda environment, there is a **local.js** file that executes the same code. You can run this with an npm script

```
npm run run:local
```

## License

Licensed under [MIT](./LICENSE).


Copyright © 2020 YellowCrest Technologies
