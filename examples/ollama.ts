import { chromium } from 'playwright'
import { Output } from 'ai'
import { ollama } from 'ollama-ai-provider-v2'
import { z } from 'zod'
import LLMScraper from './../src/index.js'

// Launch a browser instance
const browser = await chromium.launch()

// Initialize LLM provider
const llm = ollama('gemma3:1b')

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
const { data } = await scraper.run(page, Output.object({ schema }), {
  format: 'html',
})

console.log(data)

await page.close()
await browser.close()
