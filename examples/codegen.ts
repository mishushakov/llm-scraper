import { chromium } from 'playwright'
import { z } from 'zod'
import { anthropic } from '@ai-sdk/anthropic'
import LLMScraper from './../src'

// Launch a browser instance
const browser = await chromium.launch()

// Initialize LLM provider
const llm = anthropic('claude-3-5-sonnet-20240620')

// Create a new LLMScraper
const scraper = new LLMScraper(llm)

// Open new page
const page = await browser.newPage()
await page.goto('https://www.bbc.com')

// Define schema to extract contents into
const schema = z.object({
  news: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      url: z.string(),
    })
  ),
})

// Generate code and run it on the page
const { code } = await scraper.generate(page, schema)
console.log('code', code)

const result = await page.evaluate(code)
const data = schema.parse(result)

// Show the parsed result
console.log('result', data)

await page.close()
await browser.close()
