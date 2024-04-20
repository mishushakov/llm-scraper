import z from 'zod'
import { chromium } from 'playwright'
import LLMScraper from '../src'

// Create a new browser instance
const browser = await chromium.launch()

// Initialize the LLMScraper instance
const scraper = new LLMScraper(browser)

// Define schema to extract contents into
const schema = z.object({
  title: z.string().describe('Title of the page'),
})

// URLs to scrape
const urls = ['https://example.com', 'https://browserbase.com']

// Run the scraper
const pages = await scraper.run(urls, {
  schema,
  mode: 'text',
  closeOnFinish: true,
})

// Stream the result from LLM
for await (const page of pages) {
  console.log(page.data)
}
