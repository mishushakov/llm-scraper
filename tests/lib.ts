import z from 'zod'
import { chromium } from 'playwright'
import LLMScraper from '../src'

const browser = await chromium.launch()
const scraper = new LLMScraper(browser)

const schema = z.object({
  title:z.string().describe('Title of the page'),
})

const pages = await scraper.run(['https://example.com'], {
  schema,
  mode: 'text',
  closeOnFinish: true,
})

console.log(pages[0])
