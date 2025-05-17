import { z } from 'zod'
import { expect, test } from './index'

test('streaming', async ({ page, scraper }) => {
  await page.goto('https://news.ycombinator.com')

  const schema = z
    .object({
      title: z.string(),
      points: z.number(),
      by: z.string(),
      commentsURL: z.string(),
    })
    .describe('Top 5 stories on Hacker News')

  const { stream } = await scraper.stream(page, schema, {
    output: 'array',
    format: 'html',
  })

  let last: Partial<z.infer<typeof schema>>[] = []
  for await (const item of stream) {
    last = item as typeof last
  }

  expect(last).toHaveLength(5)
}, 10000)
