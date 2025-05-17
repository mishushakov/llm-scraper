import { jsonSchema } from 'ai'
import { expect, test } from './index'

test('scrapes top 3 stories from Hacker News', async ({ page, scraper }) => {
  await page.goto('https://news.ycombinator.com')

  const schema = {
    type: 'object',
    properties: {
      top: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
          },
          required: ['title'],
        },
        minItems: 3,
        maxItems: 3,
        description: 'Top 3 stories on Hacker News',
      },
    },
    required: ['top'],
  }

  const { data } = await scraper.run(page, jsonSchema(schema), {
    format: 'html',
  })

  // check length
  expect(data.top).toHaveLength(3)
})
