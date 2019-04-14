const SQS = require('aws-sdk/clients/sqs')
const sqs = new SQS({ apiVersion: '2012-11-05' })
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
    const { MTG_BOT_SQS_URL_PROD } = await getParameters('MTG_BOT_SQS_URL_PROD')

    await sqs.sendMessage({
      MessageBody: JSON.stringify(slackEvent),
      QueueUrl: MTG_BOT_SQS_URL_PROD
    }).promise()

    return createResponse({ action: true })
  } catch (e) {
    console.log(e)
    return createResponse({ action: false })
  }
}
