import { chromium } from 'playwright'
import { z } from 'zod'
import { openai } from '@ai-sdk/openai'
import LLMScraper from './../src'

// Launch a browser instance
const browser = await chromium.launch()

// Initialize LLM provider
const llm = openai.chat('gpt-4o')

// Create a new LLMScraper
const scraper = new LLMScraper(browser, llm)

// Define schema to extract contents into
const schema = z.object({
  title: z.string().describe('Title of the webpage'),
})

// URLs to scrape
const urls = [
  'https://ft.com',
  'https://text.npr.org',
  'https://meduza.io',
  'https://theguardian.com',
]

// Run the scraper
const pages = await scraper.run(urls, {
  schema,
  mode: 'text',
  closeOnFinish: true,
})

// Stream the result from LLM
for await (const page of pages) {
  console.log(`Page Title: ${page.data?.title}`)
}
