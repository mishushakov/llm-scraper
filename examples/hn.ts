import { chromium } from 'playwright'
import { z } from 'zod'
import { openai } from '@ai-sdk/openai'
import LLMScraper from './../src'

// Launch a browser instance
const browser = await chromium.launch()

// Initialize LLM provider
const llm = openai.chat('gpt-4o')

// Create a new LLMScraper
const scraper = new LLMScraper(llm)

// Open new page
const page = await browser.newPage()
await page.goto('https://news.ycombinator.com')

// Define schema to extract contents into
const schema = z.object({
  top: z
    .array(
      z.object({
        title: z.string(),
        points: z.number(),
        by: z.string(),
        commentsURL: z.string(),
      })
    )
    .length(5)
    .describe('Top 5 stories on Hacker News'),
})

// Run the scraper
const { data } = await scraper.run(page, schema, {
  format: 'html',
})

// Show the result from LLM
console.log(data.top)

await page.close()
await browser.close()
