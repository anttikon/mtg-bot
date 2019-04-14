const fetch = require('node-fetch')
const SSM = require('aws-sdk/clients/ssm')
const ssm = new SSM()

async function getParameters(...parameters) {
  const params = {
    Names: parameters,
    WithDecryption: true
  }

  const response = await ssm.getParameters(params).promise()
  return response.Parameters.reduce((result, parameter) => {
    result[parameter.Name] = parameter.Value
    return result
  }, {})
}

module.exports.getParameters = getParameters

function createResponse(json, statusCode = 200) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(json),
  }
}

module.exports.createResponse = createResponse

async function postSlackMessage(message) {
  const { MTG_BOT_SLACK_TOKEN_PROD } = await getParameters('MTG_BOT_SLACK_TOKEN_PROD')
  return fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MTG_BOT_SLACK_TOKEN_PROD}`,
      'Content-Type': 'application/json;charset=utf-8'
    },
    body: JSON.stringify({
      ...message
    })
  })
}

module.exports.postSlackMessage = postSlackMessage
