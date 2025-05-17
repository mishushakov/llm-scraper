import { expect, test } from './index'
import { z } from 'zod'

test('scrapes top 3 stories from Hacker News', async ({ page, scraper }) => {
  await page.goto('https://news.ycombinator.com')

  const schema = z.object({
    top: z
      .array(
        z.object({
          title: z.string(),
        })
      )
      .length(3)
      .describe('Top 3 stories on Hacker News'),
  })

  const { data } = await scraper.run(page, schema, {
    format: 'image',
  })

  // check schema
  expect(schema.safeParse(data).success).toBe(true)
})
