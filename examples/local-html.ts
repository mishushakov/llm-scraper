// Example will grab todays HN page and works a lot like examples/hn.ts but
// does the parsing from a local HTML file instead of using chromium/playwright
import { z } from 'zod'
import OpenAI from 'openai'
import LLMScraper from '../src'
import path from 'path'
import { writeFileSync } from 'fs'

// Initialize LLM provider
const llm = new OpenAI()

// Create a new LLMScraper
const scraper = new LLMScraper(null, llm)

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
    .length(5) // How many results to parse for this specific instance.
    .describe('Top 5 stories on Hacker News'),
})

// Where we store the local HTML file for this example.
const HNRawHtmlPath = path.resolve('./example-hn.html');

// Grab today's HN front page to run the example
await fetch('https://news.ycombinator.com/')
  .then((res) => res.text())
  .then((html) => writeFileSync(HNRawHtmlPath, html, { encoding: 'utf-8', flag: 'w' }))
  .catch((e) => {
    console.error("Failed to fetch content from Hackernews", e)
  })

// Local file paths to scrape - will be loaded from local filepaths.
const filePaths = [HNRawHtmlPath]

// Run the scraper
const pages = await scraper.runFiles(filePaths, {
  model: 'gpt-4-turbo',
  schema,
  mode: 'html',
  closeOnFinish: true,
})

// Stream the result from LLM
for await (const page of pages) {
  console.log(page.data)
}
