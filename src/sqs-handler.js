const { orderBy, flatten, sumBy, uniq, sample } = require('lodash')
const fetch = require('node-fetch')
const { getParameters } = require('./utils')

function parseCardQuery(message) {
  const bracketedCardNames = message.match(/\[(.*?)\]/g) || []
  return bracketedCardNames.map(cardName => cardName.substring(1, cardName.length - 1))
}

const querystringify = (query, attribute) => query.map(value => `${attribute}=${encodeURIComponent(value)}`).join('&')

async function postMessage(message) {
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

function getImageUrl(card, MTG_IMAGE_URL) {
  if (card.multiverseids) {
    return `${MTG_IMAGE_URL}/api/v1/images?multiverseid=${card.multiverseids.join('&multiverseid=')}`
  }
  return `${MTG_IMAGE_URL}/api/v1/images?multiverseid=${card.multiverseId}`
}

function formatOwnedBy(card) {
  const sortedCards = orderBy(card.ownedBy, 'ownedCount', 'desc')
  return sortedCards.map(user => `${user.username}: ${user.ownedCount} || ${user.blocks.join(', ')}`).join('\n')
}

function createLinks(card) {
  const mcmLink = `<https://en.magiccardmarket.eu/?mainPage=showSearchResult&searchFor=${encodeURIComponent(card.name)}|MagicCardMarket>`
  const scryfallLink = `<https://scryfall.com/search?q=${encodeURIComponent(card.name)}|Scryfall>`
  return `${mcmLink} | ${scryfallLink}`
}

function toSlackAttachment(card, MTG_BOT_MTG_IMAGE_API_URL_PROD) {
  const slackAttachment = {
    title: card.names && card.names.length > 0 ? `${card.names[0]} / ${card.names[1]}` : card.name,
    title_link: `http://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=${card.multiverseId}`,
    image_url: getImageUrl(card, MTG_BOT_MTG_IMAGE_API_URL_PROD),
    footer: formatOwnedBy(card),
  }
  const textRows = [createLinks(card)]
  if (card.prices && card.prices.lowExPrice) {
    const priceFrom = `lowex ${card.prices.lowExPrice}€ / trend ${card.prices.trendPrice}€ / avg ${card.prices.avgPrice}€`
    textRows.push(priceFrom)
  }
  slackAttachment.text = textRows.join('\n')
  return slackAttachment
}

function getUniqueCardsWithRandomMultiverseId(cards) {
  return cards.reduce((result, card) => {
    const {name, prices, ownedBy} = card

    if(result.find(addedCard => addedCard.name === name)) {
      return result
    }

    const randomMultiverseId = sample(cards.filter(c => c.name === name).map(c => c.multiverseId))
    return [...result, {name, multiverseId: randomMultiverseId, prices, ownedBy}]
  }, [])
}

async function getCardsFromMtgApi(cardQuery) {
  const { MTG_BOT_MTG_API_URL_PROD } = await getParameters('MTG_BOT_MTG_API_URL_PROD')
  return (await fetch(`${MTG_BOT_MTG_API_URL_PROD}/v1/cards?${querystringify(cardQuery, 'c')}&fuzzy=true&prices=true`)).json()
}

async function fetchOwnedByStatistics(cards) {
  const { MTG_BOT_MTG_CATALOG_URL_PROD } = await getParameters('MTG_BOT_MTG_CATALOG_URL_PROD')

  const qs = querystringify(cards.map(card => card.name), 'cardName')
  return (await fetch(`${MTG_BOT_MTG_CATALOG_URL_PROD}/api/ext/cards?${qs}`)).json()
}

function getOwnedStatisticsByCard(cardName, ownedStats) {
  const cardStats = ownedStats.filter(cardStats => cardStats.cardName === cardName)

  if (!cardStats) {
    return card
  }

  const usernames = cardStats.map(cardStat => cardStat.owners.map(owner => owner.username))
  const uniqueUsernames = uniq(flatten(usernames))

  return uniqueUsernames.map(username => {
    const statistics = cardStats.map(cardStat => cardStat.owners.find(owner => owner.username === username)).filter(v => !!v)
    const blocks = statistics.map(statistic => statistic.blockName)
    return { username, ownedCount: sumBy(statistics, 'ownedCount'), blocks }
  })
}

function getIconEmoji(slackEvent) {
  if (slackEvent.event.user === 'U0DKXFHUY') {
    return ':mtg-blue:'
  }
  return ':mtg-green:'
}

async function handleEvent(slackEvent) {
  const {channel} = slackEvent.event
  const cardQuery = parseCardQuery(slackEvent.event.text)

  if (cardQuery.length === 0) {
    return false
  }

  const { MTG_BOT_MTG_IMAGE_URL_PROD } = await getParameters( 'MTG_BOT_MTG_IMAGE_URL_PROD')

  const cards = await getCardsFromMtgApi(cardQuery)
  const uniqueCardNames = [...new Set(cards.map(card => card.name))]

  if (uniqueCardNames.length === 0) {
    return postMessage({ text: ':clippy: - No results! :sob:', channel })
  } else if (uniqueCardNames.length > 100) {
    return postMessage({ text: `:mtg-black: - Too many results: ${uniqueCardNames.length}`, channel })
  } else if (uniqueCardNames.length > 5) {
    return postMessage({ text: uniqueCardNames.join(' / '), channel })
  }

  const iconEmoji = getIconEmoji(slackEvent)

  const ownedStatistics = await fetchOwnedByStatistics(cards)
  const populatedCards = cards.map(card => ({...card, ownedBy: getOwnedStatisticsByCard(card.name, ownedStatistics)}))
  const attachments = getUniqueCardsWithRandomMultiverseId(populatedCards).map(card => toSlackAttachment(card, MTG_BOT_MTG_IMAGE_URL_PROD))
  return postMessage({ attachments, channel, icon_emoji: iconEmoji })
}

module.exports.run = async (event) => {
  for (const record of event.Records) {
    await handleEvent(JSON.parse(record.body))
  }
  return { ok: true }
}
