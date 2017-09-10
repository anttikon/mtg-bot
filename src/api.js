import fetch from 'node-fetch'
import querystring from 'querystring'
import { uniqBy } from 'lodash'

export default {
  mtgApi: {
    getCards: async (cardNames) => {
      const qs = querystring.stringify({ card: cardNames })
      const cards = await (await fetch(`${process.env.MTG_API_URL}/api/v1/cards?${qs}`)).json()
      return uniqBy(cards, 'name')
    },
  },
  mtgCatalog: {
    getOwnerStatistics: async (cardNames) => {
      const qs = querystring.stringify({ cardName: cardNames })
      return (await fetch(`${process.env.MTG_CATALOG_URL}/ext/api/card-owners?${qs}`)).json()
    },
  },
}
