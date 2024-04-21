import { Browser, BrowserContext } from 'playwright'
import Turndown from 'turndown'
import OpenAI from 'openai'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

type ScraperLoadOptions = {
  mode?: 'html' | 'text' | 'markdown' | 'image'
  closeOnFinish?: boolean
}

type ScraperLoadResult = {
  url: string
  content: string
  mode: ScraperLoadOptions['mode']
}

type ScraperRunOptions<T extends z.ZodSchema<any>> = {
  schema: T
  model: string
  temperature?: number
  baseURL?: string
  instructions?: string
} & ScraperLoadOptions

type ScraperCompletionResult<T extends z.ZodSchema<any>> = {
  data: z.infer<T> | null
  url: string
}

export default class LLMScraper<T extends z.ZodSchema<any>> {
  private browser: Browser
  private context: BrowserContext
  private options: ScraperRunOptions<T>

  constructor(browser: Browser, options: ScraperRunOptions<T>) {
    this.browser = browser
    this.options = options
  }

  // Load pages in the browser
  private async load(
    url: string | string[],
    options: ScraperLoadOptions = { mode: 'html' }
  ): Promise<Promise<ScraperLoadResult>[]> {
    this.context = await this.browser.newContext()
    const urls = Array.isArray(url) ? url : [url]

    const pages = urls.map(async (url) => {
      const page = await this.context.newPage()
      await page.goto(url)

      let content

      if (options.mode === 'html') {
        content = await page.content()
      }

      if (options.mode === 'markdown') {
        content = new Turndown().remove('head').turndown(await page.content())
      }

      if (options.mode === 'text') {
        const readable = await page.evaluate(async () => {
          const readability = await import(
            // @ts-ignore
            'https://cdn.skypack.dev/@mozilla/readability'
          )

          return new readability.Readability(document).parse()
        })

        content = `Page Title: ${readable.title}\n${readable.textContent}`
      }

      if (options.mode === 'image') {
        const image = await page.screenshot()
        content = image.toString('base64')
      }

      await page.close()
      return {
        url,
        content,
        mode: options.mode,
      }
    })

    return pages
  }

  // Prepare the pages for further processing
  private preparePage(
    page: ScraperLoadResult
  ): OpenAI.Chat.Completions.ChatCompletionContentPart[] {
    if (page.mode === 'image') {
      return [
        {
          type: 'image_url',
          image_url: { url: `data:image/jpeg;base64,${page.content}` },
        },
      ]
    }

    return [{ type: 'text', text: page.content }]
  }

  // Generate completion using OpenAI
  private generateCompletions(
    pages: Promise<ScraperLoadResult>[],
    options: ScraperRunOptions<T>
  ): Promise<ScraperCompletionResult<T>>[] {
    const openai = new OpenAI({ baseURL: options.baseURL })
    return pages.map(async (page, i) => {
      const p = await page
      const content = this.preparePage(p)
      const parameters = zodToJsonSchema(options.schema)

      const completion = await openai.chat.completions.create({
        model: options.model,
        messages: [
          {
            role: 'system',
            content:
              'You are a satistified web scraper. Extract the contents of the webpage',
          },
          { role: 'user', content },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_content',
              description:
                'Extracts the content from the given webpage(s)' ||
                options.instructions,
              parameters,
            },
          },
        ],
        tool_choice: 'auto',
        temperature: options.temperature,
      })

      if (pages.length - 1 === i && options.closeOnFinish) {
        await this.context.close()
        await this.browser.close()
      }

      const c = completion.choices[0].message.tool_calls[0].function.arguments
      return {
        data: JSON.parse(c),
        url: p.url,
      }
    })
  }

  // Load pages and generate completion
  async run(url: string | string[]) {
    const pages = await this.load(url, this.options)
    return this.generateCompletions(pages, this.options)
  }

  // Close the current context and the browser
  async close() {
    await this.context.close()
    await this.browser.close()
  }
}
