import { Browser, BrowserContext } from 'playwright'
import Turndown from 'turndown'
import OpenAI from 'openai'
import { LlamaModel } from 'node-llama-cpp'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import {
  generateLlamaCompletions,
  generateOpenAICompletions,
} from './models.js'

export type ScraperLoadOptions = {
  mode?: 'html' | 'text' | 'markdown' | 'image'
  closeOnFinish?: boolean
}

export type ScraperLoadResult = {
  url: string
  content: string
  mode: ScraperLoadOptions['mode']
}

export type ScraperRunOptions<T extends z.ZodSchema<any>> = {
  schema: T
  model?: string
  prompt?: string
  temperature?: number
} & ScraperLoadOptions

export type ScraperCompletionResult<T extends z.ZodSchema<any>> = {
  data: z.infer<T> | null
  url: string
}

export default class LLMScraper {
  private context: BrowserContext

  constructor(
    private browser: Browser,
    private client: OpenAI | LlamaModel,
  ) {
    this.browser = browser
    this.client = client
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
        const body = await page.innerHTML('body')
        content = new Turndown().turndown(body)
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

  // Generate completion using OpenAI
  private generateCompletions<T extends z.ZodSchema<any>>(
    pages: Promise<ScraperLoadResult>[],
    options: ScraperRunOptions<T>
  ): Promise<ScraperCompletionResult<T>>[] {
    const schema = zodToJsonSchema(options.schema)
    return pages.map(async (page, i) => {
      switch (this.client.constructor) {
        case OpenAI:
          return generateOpenAICompletions<T>(
            this.client as OpenAI,
            options.model,
            await page,
            schema,
            options?.prompt,
            options?.temperature
          )
        case LlamaModel:
          return generateLlamaCompletions<T>(
            this.client,
            await page,
            schema,
            options?.prompt,
            options?.temperature
          )
        default:
          throw new Error('Invalid client')
      }
    })
  }

  // Load pages and generate completion
  async run<T extends z.ZodSchema<any>>(
    url: string | string[],
    options: ScraperRunOptions<T>
  ) {
    const pages = await this.load(url, options)
    return this.generateCompletions<T>(pages, options)
  }

  // Close the current context and the browser
  async close() {
    await this.context.close()
    await this.browser.close()
  }
}
