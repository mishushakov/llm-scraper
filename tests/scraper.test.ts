import { z } from 'zod'
import { test, expect } from './index'
import { Output, jsonSchema } from 'ai'

const storySchema = z.object({
  title: z.string(),
  points: z.number(),
  by: z.string(),
  commentsURL: z.string(),
})

const schema = z.object({
  top: z.array(storySchema).length(5).describe('Top 5 stories on Hacker News'),
})

test('scrapes top 5 stories from Hacker News', async ({ page, scraper }) => {
  await page.goto('https://news.ycombinator.com')

  const { data } = await scraper.run(page, Output.object({ schema }))

  expect(schema.safeParse(data).success).toBe(true)
})

test('scrapes top 5 stories from Hacker News (image format)', async ({
  page,
  scraper,
}) => {
  await page.goto('https://news.ycombinator.com')

  const { data } = await scraper.run(page, Output.object({ schema }), {
    format: 'image',
  })

  expect(schema.safeParse(data).success).toBe(true)
})

test('scrapes top 5 stories from Hacker News (markdown format)', async ({
  page,
  scraper,
}) => {
  await page.goto('https://news.ycombinator.com')

  const { data } = await scraper.run(page, Output.object({ schema }), {
    format: 'markdown',
  })

  expect(schema.safeParse(data).success).toBe(true)
})

test('scrapes top 5 stories from Hacker News (raw html)', async ({
  page,
  scraper,
}) => {
  await page.goto('https://news.ycombinator.com')

  const { data } = await scraper.run(page, Output.object({ schema }), {
    format: 'raw_html',
  })

  expect(schema.safeParse(data).success).toBe(true)
})

test('scrapes top 5 stories from Hacker News (code generation)', async ({
  page,
  scraper,
}) => {
  await page.goto('https://news.ycombinator.com')

  const { code } = await scraper.generate(page, Output.object({ schema }))
  const result = await page.evaluate(code)

  expect(schema.safeParse(result).success).toBe(true)
})

test('scrapes top 5 stories from Hacker News (json schema)', async ({
  page,
  scraper,
}) => {
  await page.goto('https://news.ycombinator.com')

  // Define JSON schema directly (instead of using Zod)
  const jsonSchemaDefinition = jsonSchema({
    type: 'object',
    properties: {
      top: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            points: { type: 'number' },
            by: { type: 'string' },
            commentsURL: { type: 'string' },
          },
          required: ['title', 'points', 'by', 'commentsURL'],
          additionalProperties: false,
        },
        minItems: 5,
        maxItems: 5,
      },
    },
    required: ['top'],
    additionalProperties: false,
  })

  const { data } = await scraper.run(
    page,
    Output.object({ schema: jsonSchemaDefinition })
  )

  // Validate against the original Zod schema
  expect(schema.safeParse(data).success).toBe(true)
})

test('scrapes example.com (streaming)', async ({ page, scraper }) => {
  await page.goto('https://example.com')

  const { stream } = await scraper.stream(
    page,
    Output.object({
      schema: z.object({
        h1: z.string().describe('The main heading of the page'),
      })
    })
  )

  let text = ''
  for await (const item of stream) {
    text = item.h1 || ''
  }

  expect(text).toBe('Example Domain')
})

test('scrapes top stories from Hacker News (streaming, array)', async ({
  page,
  scraper,
}) => {
  await page.goto('https://news.ycombinator.com')

  const { stream } = await scraper.stream(page, Output.array({ element: storySchema }), {
    format: 'raw_html',
  })

  let last: Partial<z.infer<typeof storySchema>>[] = []
  for await (const item of stream) {
    last = item as typeof last
  }

  expect(last).toHaveLength(30)
})
