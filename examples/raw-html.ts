// Example will grab todays HN page and works a lot like examples/hn.ts but
// does the parsing from a the RAW html response instead of using chromium/playwright
import { z } from 'zod'
import OpenAI from 'openai'
import LLMScraper from '../src'

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

// Grab today's HN front page to run the example
const htmlString = await fetch('https://news.ycombinator.com/')
  .then((res) => res.text())
  .catch((e) => {
    console.error("Failed to fetch content from Hackernews", e)
    return null;
  })

// Run the scraper
const pages = await scraper.rawHTML([htmlString], {
  model: 'gpt-4-turbo',
  schema,
  mode: 'html',
  closeOnFinish: true,
})

// Stream the result from LLM
for await (const page of pages) {
  console.log(page.data)
}
