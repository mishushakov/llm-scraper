import z from 'zod'
import { chromium } from 'playwright'
import LLMScraper from '../src'

const browser = await chromium.launch()
const scraper = new LLMScraper(browser)

const schema = z.object({
  title: z.string().describe('Title of the page'),
})

const urls = ['https://example.com', 'https://browserbase.com']

const pages = await scraper.run(urls, {
  schema,
  mode: 'text',
  closeOnFinish: true,
})

// Stream the pages
for await (const page of pages) {
  console.log(page?.title)
}
