import { openai } from '@ai-sdk/openai'
import { generateText, jsonSchema as toJSONSChema, tool } from 'ai'
import { chromium } from 'playwright'
import { z } from 'zod'
import LLMScraper from './../src'

const model = openai('gpt-4o-mini')
const scraper = new LLMScraper(model)

const { text } = await generateText({
  model,
  tools: {
    scrapeWebsite: tool({
      description: 'Scrape a website with a given schema and URL',
      parameters: z.object({
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
        const schema = toJSONSChema(JSON.parse(jsonSchema))

        // Run the scraper
        const result = await scraper.run(page, schema)
        await page.close()
        await browser.close()

        // Feed the result back to the model
        return result.data
      },
    }),
  },
  maxSteps: 2,
  prompt: 'List top stories from HackerNews frontpage and summarize them',
})

console.log(text)
