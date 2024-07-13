import { chromium } from 'playwright'
import { ollama } from 'ollama-ai-provider'
import { z } from 'zod'
import LLMScraper from './../src'

// Launch a browser instance
const browser = await chromium.launch()

// Initialize LLM provider
const llm = ollama('llama3')

// Initialize a new LLMScraper with local model
const scraper = new LLMScraper(llm)

// Open the page
const page = await browser.newPage()
await page.goto('https://example.com')

// Define schema to extract contents into
const schema = z.object({
  h1: z.string().describe('The main heading of the page'),
})

// Run the scraper
const { data } = await scraper.run(page, schema, {
  format: 'html',
})

console.log(data)

await page.close()
await browser.close()
