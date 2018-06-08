const fetch = require('node-fetch')
const cheerio = require('cheerio')
const moment = require('moment')
const { groupBy, sum } = require('lodash')

fetchShootings()
  .then(shootings => {
    const byYear = groupBy(shootings, ({ date }) => date.slice(0, 4))
    const sep = '\t'

    console.log(['year', 'events', 'deaths', 'injuries'].join(sep))
    Object.keys(byYear).forEach(year => {
      const annual = byYear[year]
      console.log([
        year,
        // events
        annual.length,
        // deaths:
        sum(annual.map(({ deaths }) => deaths)),
        // injuries
        sum(annual.map(({ injuries }) => injuries))
      ].join(sep))
    })
  })

function fetchShootings () {
  return fetch('https://en.wikipedia.org/wiki/List_of_school_shootings_in_the_United_States')
    .then(res => res.text())
    .then(body => parse(body))
}

function parse (body) {
  const $ = cheerio.load(body)

  return $('.wikitable > tbody tr')
    .filter((index, tr) =>
      // ignore headings
      $(tr).children().first().text() !== 'Date'
    )
    .map((index, tr) =>
      $(tr)
        .children()
        .map((i, td) =>
          $(td).text()
        )
        .toArray()
        .reduce((res, val, index) => {
          res[indexToColumn(index)] = val
          return res
        }, {})
    )
    .toArray()
    .map(({ date, location, deaths, injuries, description }) => {
      const intInjuries = parseInt(injuries)
      return {
        date: moment(
          date.startsWith('00000000') ? date.slice(23) : date,
          'MMMM DD, YYYY'
        ).toISOString(),
        deaths: parseInt(deaths),
        // it's probably a '?'. only occurs a few times.
        injuries: Number.isNaN(intInjuries) ? 0 : intInjuries
      }
    })
}

const columns = [
  'date',
  'location',
  'deaths',
  'injuries',
  'description'
]
function indexToColumn (i) {
  return columns[i]
}
