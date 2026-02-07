import { openai } from '@ai-sdk/openai'
import {
  Output,
  generateText,
  jsonSchema as toJSONSchema,
  stepCountIs,
  tool,
} from 'ai'
import { chromium } from 'playwright'
import { z } from 'zod'
import LLMScraper from './../src/index.js'

const model = openai('gpt-4o-mini')
const scraper = new LLMScraper(model)

const { text } = await generateText({
  model,
  tools: {
    scrapeWebsite: tool({
      description: 'Scrape a website with a given schema and URL',
      inputSchema: z.object({
        url: z.string(),
        jsonSchema: z.string(),
      }),
      execute: async ({ url, jsonSchema }) => {
        console.log('scraping website', url)
        console.log('with schema', jsonSchema)

        // Launch a browser instance
        const browser = await chromium.launch()

        // Open new page
        const page = await browser.newPage()
        await page.goto('https://news.ycombinator.com')

        // Parse jsonSchema
        const schema = toJSONSchema(JSON.parse(jsonSchema))

        // Run the scraper
        const result = await scraper.run(page, Output.object({ schema }))
        await page.close()
        await browser.close()

        // Feed the result back to the model
        return result.data
      },
    }),
  },
  stopWhen: stepCountIs(2),
  prompt: 'List top stories from HackerNews frontpage and summarize them',
})

console.log(text)
