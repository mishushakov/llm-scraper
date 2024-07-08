import { chromium } from 'playwright'
import { LlamaModel } from 'node-llama-cpp'
import { z } from 'zod'
import LLMScraper from './../src'

// Launch a browser instance
const browser = await chromium.launch()

const modelPath =
  '/Users/mish/jan/models/tinyllama-1.1b/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf'

const llm = new LlamaModel({ modelPath })

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
  format: 'text',
})

console.log(data)

await page.close()
await browser.close()
