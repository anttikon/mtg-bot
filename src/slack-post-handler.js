const { orderBy, flatten, sumBy, uniq } = require('lodash')
const { getParameters, postSlackMessage } = require('./utils')
const { getCardsFromMtgApi, fetchOwnedByStatistics } = require('./integrations')

function parseCardQuery(message) {
  const bracketedCardNames = message.match(/\[(.*?)\]/g) || []
  return bracketedCardNames.map(cardName => cardName.substring(1, cardName.length - 1))
}

function getImageUrl(card, MTG_IMAGE_URL) {
  return `${MTG_IMAGE_URL}/api/v1/images?multiverseid=${card.multiverse_ids.join('&multiverseid=')}`
}

function formatOwnedBy(card) {
  const sortedCards = orderBy(card.ownedBy, 'ownedCount', 'desc')
  return sortedCards.map(user => `${user.username}: ${user.ownedCount} || ${user.blocks.join(', ')}`).join('\n')
}

function createLinks(card) {
  const mcmLink = `<https://www.cardmarket.com/en/Magic/Products/Search?searchString=${encodeURIComponent(card.name)}|MagicCardMarket>`
  const scryfallLink = `<https://scryfall.com/search?q=${encodeURIComponent(card.name)}|Scryfall>`
  return `${mcmLink} | ${scryfallLink}`
}

function toSlackAttachment(card, MTG_BOT_MTG_IMAGE_API_URL_PROD) {
  const slackAttachment = {
    title: card.names && card.names.length > 0 ? `${card.names[0]} / ${card.names[1]}` : card.name,
    title_link: `http://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=${card.multiverse_ids[0]}`,
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

function getUniqueCards(cards) {
  return cards.reduce((result, card) => {
    const {name, prices, ownedBy, multiverse_ids} = card

    if (result.find(addedCard => addedCard.name === name)) {
      return result
    }

    return [...result, {name, multiverse_ids, prices, ownedBy}]
  }, [])
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

  const { MTG_BOT_MTG_IMAGE_URL_PROD } = await getParameters('MTG_BOT_MTG_IMAGE_URL_PROD')

  const cards = await getCardsFromMtgApi(cardQuery)
  const uniqueCardNames = [...new Set(cards.map(card => card.name))]

  if (uniqueCardNames.length === 0) {
    return postSlackMessage({ text: ':clippy: - No results! :sob:', channel })
  } else if (uniqueCardNames.length > 100) {
    return postSlackMessage({ text: `:mtg-black: - Too many results: ${uniqueCardNames.length}`, channel })
  } else if (uniqueCardNames.length > 5) {
    return postSlackMessage({ text: uniqueCardNames.join(' / '), channel })
  }

  const iconEmoji = getIconEmoji(slackEvent)

  const ownedStatistics = await fetchOwnedByStatistics(cards)
  const populatedCards = cards.map(card => ({...card, ownedBy: getOwnedStatisticsByCard(card.name, ownedStatistics)}))
  const attachments = getUniqueCards(populatedCards).map(card => toSlackAttachment(card, MTG_BOT_MTG_IMAGE_URL_PROD))
  return postSlackMessage({ attachments, channel, icon_emoji: iconEmoji })
}

module.exports.run = async (event) => {
  try {
    await handleEvent(event)
    return { ok: true }
  } catch (e) {
    console.log(e)
    return { ok: false }
  }
}
