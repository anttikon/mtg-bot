const Lambda = require('aws-sdk/clients/lambda')
const lambda = new Lambda()
const { getParameters, createResponse } = require('./utils')

module.exports.run = async (event) => {
  const slackEvent = JSON.parse(event.body)

  if (slackEvent.challenge) {
    return createResponse({ challenge: slackEvent.challenge })
  }

  if (slackEvent.event.type !== 'message' || slackEvent.event.subtype === 'bot_message' || !slackEvent.event.text) {
    return createResponse({ action: false })
  }

  try {
    const { MTG_BOT_SLACK_POST_LAMBDA } = await getParameters('MTG_BOT_SLACK_POST_LAMBDA')

    const params = {
      FunctionName: MTG_BOT_SLACK_POST_LAMBDA,
      InvocationType: 'Event',
      LogType: 'None',
      Payload: JSON.stringify(slackEvent),
    }
    await lambda.invoke(params).promise()

    return createResponse({ action: true })
  } catch (e) {
    console.log(e)
    return createResponse({ action: false })
  }
}
