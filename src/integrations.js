const fetch = require('node-fetch')
const { getParameters } = require('./utils')

const querystringify = (query, attribute) => query.map(value => `${attribute}=${encodeURIComponent(value)}`).join('&')

async function getCardsFromMtgApi(cardQuery) {
  const { MTG_BOT_MTG_API_URL_PROD } = await getParameters('MTG_BOT_MTG_API_URL_PROD')

  const qs = querystringify(cardQuery, 'c')
  return (await fetch(`${MTG_BOT_MTG_API_URL_PROD}/v1/cards?${qs}&fuzzy=true&prices=true`)).json()
}

module.exports.getCardsFromMtgApi = getCardsFromMtgApi

async function fetchOwnedByStatistics(cards) {
  const { MTG_BOT_MTG_CATALOG_URL_PROD } = await getParameters('MTG_BOT_MTG_CATALOG_URL_PROD')

  const qs = querystringify(cards.map(card => card.name), 'cardName')
  return (await fetch(`${MTG_BOT_MTG_CATALOG_URL_PROD}/api/ext/cards?${qs}`)).json()
}

module.exports.fetchOwnedByStatistics = fetchOwnedByStatistics
