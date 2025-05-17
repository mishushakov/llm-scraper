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

  // Generate scraping code
  const { code } = await scraper.generate(page, schema)
  throw new Error(code)

  // Evaluate the generated code in the page context
  const result = await page.evaluate(code)

  // Validate the result
  const parsed = schema.safeParse(result)
  expect(parsed.success).toBe(true)
  if (parsed.success) {
    expect(parsed.data.top).toHaveLength(3)
  }
})
