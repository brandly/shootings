const fetch = require('node-fetch')
const cheerio = require('cheerio')
const moment = require('moment')
const { groupBy, sum } = require('lodash')
const { unparse } = require('papaparse')

async function fetchShootings(urls, columns) {
  const results = await Promise.all(
    urls.map((url) =>
      fetch(url)
        .then((res) => res.text())
        .then((text) => parse(text, columns))
    )
  )
  return results
    .reduce((a, b) => a.concat(b), [])
    .sort((a, b) => {
      if (a.date > b.date) return 1
      if (a.date < b.date) return -1
      return 0
    })
}

const flag = process.argv[2]
let promise
if (flag === 'school') {
  promise = fetchShootings(
    [
      'https://en.wikipedia.org/wiki/List_of_school_shootings_in_the_United_States_(before_2000)',
      'https://en.wikipedia.org/wiki/List_of_school_shootings_in_the_United_States'
    ],
    ['date', 'location', 'deaths', 'injuries', 'description']
  )
} else if (flag === 'mass') {
  promise = fetchShootings(
    [
      'https://en.wikipedia.org/wiki/List_of_mass_shootings_in_the_United_States'
    ],
    ['date', 'location', 'deaths', 'injuries', 'totals', 'description']
  )
} else {
  throw new Error(`Unexpected flag "${flag}"`)
}

promise
  .then((shootings) => {
    process.stdout.write(unparse(shootings, { delimiter: '\t', newline: '\n' }))
  })
  .catch((err) => console.error(err))

function parse(body, columns) {
  const $ = cheerio.load(body)

  return $('.wikitable > tbody tr')
    .filter(
      (index, tr) =>
        // ignore headings
        $(tr).children().first().text().trim() !== 'Date'
    )
    .map((index, tr) =>
      $(tr)
        .children()
        .map((i, td) => $(td).text())
        .toArray()
        .reduce((res, val, index) => {
          res[columns[index]] = val
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
        injuries: Number.isNaN(intInjuries) ? 0 : intInjuries,
        location: (location.includes('!')
          ? location.split('!')[1]
          : location
        ).trim(),
        description: description.trim()
      }
    })
}
