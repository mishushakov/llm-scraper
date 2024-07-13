import { Page } from 'playwright'
import Turndown from 'turndown'
import { LanguageModelV1 } from '@ai-sdk/provider'
import { LlamaModel } from 'node-llama-cpp'
import { z } from 'zod'
import {
  generateLlamaCompletions,
  generateAISDKCompletions,
  streamAISDKCompletions,
  generateAISDKCode,
} from './models.js'

import cleanup from './cleanup.js'

export type ScraperLoadOptions =
  | {
      format?: 'html' | 'text' | 'markdown' | 'cleanup'
    }
  | {
      format: 'custom'
      formatFunction: (page: Page) => Promise<string> | string
    }
  | {
      format: 'image'
      fullPage?: boolean
    }

export type ScraperLoadResult = {
  url: string
  content: string
  format: ScraperLoadOptions['format']
}

export type ScraperLLMOptions = {
  prompt?: string
  temperature?: number
  maxTokens?: number
  topP?: number
  mode?: 'auto' | 'json' | 'tool' | 'grammar'
}

export type ScraperRunOptions = ScraperLLMOptions & ScraperLoadOptions

export default class LLMScraper {
  constructor(private client: LanguageModelV1 | LlamaModel) {
    this.client = client
  }

  // Pre-process a page
  private async preprocess(
    page: Page,
    options: ScraperLoadOptions = { format: 'html' }
  ): Promise<ScraperLoadResult> {
    const url = page.url()
    let content

    if (options.format === 'html') {
      content = await page.content()
    }

    if (options.format === 'markdown') {
      const body = await page.innerHTML('body')
      content = new Turndown().turndown(body)
    }

    if (options.format === 'text') {
      const readable = await page.evaluate(async () => {
        const readability = await import(
          // @ts-ignore
          'https://cdn.skypack.dev/@mozilla/readability'
        )

        return new readability.Readability(document).parse()
      })

      content = `Page Title: ${readable.title}\n${readable.textContent}`
    }

    if (options.format === 'cleanup') {
      await page.evaluate(cleanup)
      content = await page.content()
    }

    if (options.format === 'image') {
      const image = await page.screenshot({ fullPage: options.fullPage })
      content = image.toString('base64')
    }

    if (options.format === 'custom') {
      if (
        !options.formatFunction ||
        typeof options.formatFunction !== 'function'
      ) {
        throw new Error('customPreprocessor must be provided in custom mode')
      }

      content = await options.formatFunction(page)
    }

    return {
      url,
      content,
      format: options.format,
    }
  }

  // Generate completion using AI SDK
  private async generateCompletions<T extends z.ZodSchema<any>>(
    page: ScraperLoadResult,
    schema: T,
    options?: ScraperRunOptions
  ) {
    switch (this.client.constructor) {
      default:
        return generateAISDKCompletions<T>(
          this.client as LanguageModelV1,
          page,
          schema,
          options
        )
      case LlamaModel:
        return generateLlamaCompletions<T>(this.client, page, schema, options)
    }
  }

  // Stream completions using AI SDK
  private async streamCompletions<T extends z.ZodSchema<any>>(
    page: ScraperLoadResult,
    schema: T,
    options?: ScraperRunOptions
  ) {
    switch (this.client.constructor) {
      default:
        return streamAISDKCompletions<T>(
          this.client as LanguageModelV1,
          page,
          schema,
          options
        )
      case LlamaModel:
        throw new Error('Streaming not supported with GGUF models')
    }
  }

  private async generateCode<T extends z.ZodSchema<any>>(
    page: ScraperLoadResult,
    schema: T,
    options?: ScraperLLMOptions
  ) {
    switch (this.client.constructor) {
      default:
        return generateAISDKCode<T>(
          this.client as LanguageModelV1,
          page,
          schema,
          options
        )
      case LlamaModel:
        throw new Error('Code-generation not supported with GGUF models')
    }
  }

  // Pre-process the page and generate completion
  async run<T extends z.ZodSchema<any>>(
    page: Page,
    schema: T,
    options?: ScraperRunOptions
  ) {
    const preprocessed = await this.preprocess(page, options)
    return this.generateCompletions<T>(preprocessed, schema, options)
  }

  // Pre-process the page and stream completion
  async stream<T extends z.ZodSchema<any>>(
    page: Page,
    schema: T,
    options?: ScraperRunOptions
  ) {
    const preprocessed = await this.preprocess(page, options)
    return this.streamCompletions<T>(preprocessed, schema, options)
  }

  // Pre-process the page and generate code
  async generate(page, schema: z.ZodSchema<any>, options?: ScraperLLMOptions) {
    const preprocessed = await this.preprocess(page, {
      ...options,
      format: 'cleanup',
    })
    return this.generateCode(preprocessed, schema, options)
  }
}
