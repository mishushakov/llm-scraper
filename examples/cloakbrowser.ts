import { z } from 'zod'
import { Output } from 'ai'
import { openai } from '@ai-sdk/openai'
import { launch } from 'cloakbrowser'
import LLMScraper from './../src/index.js'

// Launch CloakBrowser — stealth Chromium with source-level fingerprint patches.
// Passes Cloudflare, reCAPTCHA, and other bot detection without JS-level overrides.
// Install: npm install cloakbrowser (binary auto-downloads on first run)
const browser = await launch()

// Initialize LLM provider
const llm = openai('gpt-4o')

// Create a new LLMScraper
const scraper = new LLMScraper(llm)

// Open new page
const page = await browser.newPage()
await page.goto('https://news.ycombinator.com')

// Define schema to extract contents into
const schema = z.object({
  top: z
    .array(
      z.object({
        title: z.string(),
        points: z.number(),
        by: z.string(),
        commentsURL: z.string(),
      })
    )
    .length(5)
    .describe('Top 5 stories on Hacker News'),
})

// Run the scraper
const { data } = await scraper.run(page, Output.object({ schema }), {
  format: 'raw_html',
})

// Show the result from LLM
console.log(data)

await page.close()
await browser.close()
