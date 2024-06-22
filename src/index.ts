import { Page } from 'playwright'
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
  constructor(private client: LanguageModelV1 | LlamaModel) {
    this.client = client
  }

  // Pre-process a page
  private async preprocess(
    page: Page,
    options: ScraperLoadOptions = { mode: 'html' }
  ): Promise<ScraperLoadResult> {
    const url = page.url()
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

    return {
      url,
      content,
      mode: options.mode,
    }
  }

  // Generate completion using AISDK
  private async generateCompletions<T extends z.ZodSchema<any>>(
    page: ScraperLoadResult,
    options: ScraperRunOptions<T>
  ): Promise<ScraperCompletionResult<T>> {
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
  }

  // Load pages and generate completion
  async run<T extends z.ZodSchema<any>>(
    page: Page,
    options: ScraperRunOptions<T>
  ) {
    const preprocessed = await this.preprocess(page, options)
    return this.generateCompletions<T>(preprocessed, options)
  }
}
