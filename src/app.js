import Hapi from 'hapi'
import { uniq, sumBy, flatten } from 'lodash'
import { slackbot } from 'botkit'
import Card from './Card'
import api from './api'

import logger from './logger'

const server = new Hapi.Server();
server.connection({
  host: process.env.HOST || '0.0.0.0',
  port: process.env.PORT || 6500
})

server.route({
  method: 'GET',
  path: '/api/v1/health',
  handler: (request, reply) => reply({ ok: true })
});

server.start((err) => {
  if (err) {
    throw err;
  }
  logger.info('Server running at:', server.info.uri)
});

const controller = slackbot({ debug: false })
const bot = controller.spawn({ token: process.env.TOKEN })
bot.startRTM((err) => {
  if (err) {
    logger.error('Error!', err)
  }
})

function parseCardQuery(message) {
  const bracketedCardNames = message.match(/\[(.*?)\]/g) || []
  return bracketedCardNames.map(cardName => cardName.substring(1, cardName.length - 1))
}

async function populateOwnedBy(cards) {
  const ownedCardStats = await api.mtgCatalog.getOwnerStatistics(cards.map(card => card.name))
  return cards.map((card) => {
    const cardStats = ownedCardStats.filter(cardStats => cardStats.cardName === card.name)

    if (!cardStats) {
      return card
    }

    const usernames = cardStats.map(cardStat => cardStat.owners.map(owner => owner.username))
    const uniqueUsernames = uniq(flatten(usernames))

    const ownedBy = uniqueUsernames.map(username => {
      const statistics = cardStats.map(cardStat => cardStat.owners.find(owner => owner.username === username)).filter(v => !!v)
      const blocks = statistics.map(statistic => statistic.blockName)
      return { username: username, ownedCount: sumBy(statistics, 'ownedCount'), blocks }
    })

    return { ...card, ownedBy }
  })
}

async function getMessageReply(cards) {
  const username = 'mtgbot'
  const icon_emoji = ':mtg:'

  if (cards.length === 0) {
    return { username, icon_emoji, text: ':clippy: - No results! :sob:' }
  } else if (cards.length > 100) {
    return { username, icon_emoji, text: `:clippy: - Too many results: ${cards.length}` }
  } else if (cards.length > 5) {
    const text = cards.map(card => card.displayName).join('  /  ')
    return { username, icon_emoji, text }
  }

  const cardsWithOwnedBy = await populateOwnedBy(cards)
  const attachments = cardsWithOwnedBy.map(card => new Card(card).toSlackAttachment())
  return { username, icon_emoji, attachments }
}

const DIRECT_MESSAGE = 'direct_message'
const AMBIENT = 'ambient'

controller.hears([/\[.*?]/g], [AMBIENT, DIRECT_MESSAGE], (bot, message) => {
  controller.storage.users.get(message.user, async () => {
    const cardQuery = parseCardQuery(message.text)
    if (cardQuery.length > 0) {
      const cards = await api.mtgApi.getCards(cardQuery)
      bot.reply(message, await getMessageReply(cards))
    }
  })
})
