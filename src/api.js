import fetch from 'node-fetch'
import querystring from 'querystring'
import { uniqBy } from 'lodash'

export default {
  mtgApi: {
    getCards: async (cardNames) => {
      const qs = querystring.stringify({ c: cardNames })
      const cards = await (await fetch(`${process.env.MTG_API_URL}/v1/cards?${qs}&fuzzy=true&prices=true`)).json()
      return uniqBy(cards, 'name')
    },
  },
  mtgCatalog: {
    getOwnerStatistics: async (cardNames) => {
      const qs = querystring.stringify({ cardName: cardNames })
      return (await fetch(`${process.env.MTG_CATALOG_URL}/api/ext/cards?${qs}`)).json()
    },
  },
}
