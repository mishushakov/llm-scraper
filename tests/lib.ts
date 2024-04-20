import z from 'zod'
import { chromium } from 'playwright'
import LLMScraper from '../src'

const browser = await chromium.launch()
const scraper = new LLMScraper(browser)

const schema = z.object({
  titles: z.array(z.string().describe('Title of the page')),
})

type schema = z.infer<typeof schema>

const pages = await scraper.run(['https://example.com', 'https://browserbase.com'], {
  schema,
  mode: 'text'
})

const content = await pages
console.log(content)
