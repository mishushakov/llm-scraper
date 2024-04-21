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

type ScraperConfig = {
  baseURL?: string
  prompt?: string
  temperature?: number
}

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
} & ScraperLoadOptions

export type ScraperCompletionResult<T extends z.ZodSchema<any>> = {
  data: z.infer<T> | null
  url: string
}

export default class LLMScraper {
  private browser: Browser
  private context: BrowserContext
  private model: string | LlamaModel
  private config: ScraperConfig
  private client: OpenAI | LlamaModel

  constructor(
    browser: Browser,
    model: string | LlamaModel,
    config?: ScraperConfig
  ) {
    this.browser = browser
    this.config = config
    this.client =
      typeof model === 'string'
        ? new OpenAI({ baseURL: config.baseURL })
        : model
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
            this.model as string,
            page,
            schema,
            this.config?.prompt,
            this.config?.temperature
          )
        case LlamaModel:
          return generateLlamaCompletions<T>(
            this.client,
            page,
            schema,
            this.config?.prompt,
            this.config?.temperature
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
