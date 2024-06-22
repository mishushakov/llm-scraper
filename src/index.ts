import { Browser, BrowserContext } from 'playwright'
import Turndown from 'turndown'
import { LanguageModelV1 } from '@ai-sdk/provider'
import { LlamaModel } from 'node-llama-cpp'
import { z } from 'zod'
import {
  ScraperCompletionResult,
  generateLlamaCompletions,
  generateAISDKCompletions,
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
  prompt?: string
  temperature?: number
} & ScraperLoadOptions

export default class LLMScraper {
  private context: BrowserContext

  constructor(
    private browser: Browser,
    private client: LanguageModelV1 | LlamaModel
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

  // Generate completion using AISDK
  private generateCompletions<T extends z.ZodSchema<any>>(
    pages: Promise<ScraperLoadResult>[],
    options: ScraperRunOptions<T>
  ): Promise<ScraperCompletionResult<T>>[] {
    const loader = pages.map(async (page, i) => {
      switch (this.client.constructor) {
        default:
          return generateAISDKCompletions<T>(
            this.client as LanguageModelV1,
            await page,
            options.schema,
            options?.prompt,
            options?.temperature
          )
        case LlamaModel:
          return generateLlamaCompletions<T>(
            this.client,
            await page,
            options.schema,
            options?.prompt,
            options?.temperature
          )
      }
    })

    Promise.all(loader).then(() => {
      if (options.closeOnFinish) {
        this.close()
      }
    })

    return loader
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
