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
