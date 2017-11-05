import { uniq, sumBy } from 'lodash'
import Botkit from 'botkit'
import Card from './Card'
import api from './api'

const token = process.env.TOKEN

const controller = Botkit.slackbot({ debug: false })
controller.spawn({ token }).startRTM()

function parseCardQuery(message) {
  const bracketedCardNames = message.match(/\[(.*?)\]/g) || []
  return bracketedCardNames.map(cardName => cardName.substring(1, cardName.length - 1))
}

async function populateOwnedBy(cards) {
  const ownedCardStats = await api.mtgCatalog.getOwnerStatistics(cards.map(card => card.name))
  return cards.map((card) => {
    if (!ownedCardStats[card.name]) {
      return card
    }

    const usernames = uniq(ownedCardStats[card.name].map(ownedCard => ownedCard.username))
    const ownedBy = usernames.map((username) => {
      const results = ownedCardStats[card.name].filter(owned => owned.username === username)
      return { username, ownedCount: sumBy(results, 'ownedCount'), blockCount: results.length }
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
  } else if (cards.length > 50) {
    const text = cards.map(card => card.name).join('  /  ')
    return { username, icon_emoji, text }
  } else if (cards.length > 5) {
    const text = cards.map(card => `\`${card.name}\``).join(', ')
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
