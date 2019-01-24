import { orderBy } from 'lodash'

export default class Card {
  constructor(card) {
    this.card = card
  }

  static getImageUrl(card) {
    if (card.multiverseids) {
      return `${process.env.MTG_IMAGE_URL}/api/v1/images?multiverseid=${card.multiverseids.join('&multiverseid=')}`
    }
    return `${process.env.MTG_IMAGE_URL}/api/v1/images?multiverseid=${card.multiverseId}`
  }

  static formatOwnedBy(card) {
    const sortedCards = orderBy(card.ownedBy, 'ownedCount', 'desc')
    return sortedCards.map(user => `${user.username}: ${user.ownedCount} || ${user.blocks.join(', ')}`).join('\n')
  }

  static createLinks(card) {
    const mcmLink = `<https://en.magiccardmarket.eu/?mainPage=showSearchResult&searchFor=${encodeURIComponent(card.name)}|MagicCardMarket>`
    const scryfallLink = `<https://scryfall.com/search?q=${encodeURIComponent(card.name)}|Scryfall>`
    return `${mcmLink} | ${scryfallLink}`
  }

  toSlackAttachment() {
    const { card } = this
    const slackAttachment = {
      title: card.names ? `${card.names[0]} / ${card.names[1]}` : card.name,
      title_link: `http://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=${card.multiverseId}`,
      image_url: Card.getImageUrl(card),
      footer: Card.formatOwnedBy(card),
    }
    const textRows = [Card.createLinks(card)]
    if (card.prices && card.prices.lowExPrice) {
      const priceFrom = `lowex ${card.prices.lowExPrice}€ / trend ${card.prices.trendPrice}€ / avg ${card.prices.avgPrice}€`
      textRows.push(priceFrom)
    }
    slackAttachment.text = textRows.join('\n')
    return slackAttachment
  }
}
