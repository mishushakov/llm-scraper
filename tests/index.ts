import { test as baseTest, expect, afterAll } from 'vitest'
import LLMScraper from '../src'
import { openai } from '@ai-sdk/openai'
import { chromium, Browser } from 'playwright'

let browser: Browser | null = null

async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch()
  }
  return browser
}

afterAll(async () => {
  if (browser) {
    await browser.close()
    browser = null
  }
})

export const test = baseTest.extend<{
  page: Awaited<ReturnType<Browser['newPage']>>
  scraper: LLMScraper
}>({
  page: async ({}, use) => {
    const browser = await getBrowser()
    const page = await browser.newPage()
    await use(page)
    await page.close()
  },
  scraper: async ({}, use) => {
    const scraper = new LLMScraper(openai('gpt-4o-mini'))
    await use(scraper)
  },
})

export { expect }
