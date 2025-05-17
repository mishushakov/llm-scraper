import { type Page } from 'playwright'
import { LanguageModelV1 } from '@ai-sdk/provider'
import { z } from 'zod'
import { Schema } from 'ai'
import { preprocess, PreProcessOptions } from './preprocess.js'
import {
  generateAISDKCompletions,
  streamAISDKCompletions,
  generateAISDKCode,
} from './models.js'

export type ScraperLLMOptions = {
  prompt?: string
  temperature?: number
  maxTokens?: number
  topP?: number
  mode?: 'auto' | 'json' | 'tool'
  output?: 'array'
}

export type ScraperRunOptions = ScraperLLMOptions & PreProcessOptions

export default class LLMScraper {
  constructor(private client: LanguageModelV1) {
    this.client = client
  }

  // Pre-process the page and generate completion
  async run<T extends z.ZodSchema<any>>(
    page: Page,
    schema: T | Schema,
    options?: ScraperRunOptions
  ) {
    const preprocessed = await preprocess(page, options)
    return generateAISDKCompletions<T>(
      this.client,
      preprocessed,
      schema,
      options
    )
  }

  // Pre-process the page and stream completion
  async stream<T extends z.ZodSchema<any>>(
    page: Page,
    schema: T | Schema,
    options?: ScraperRunOptions
  ) {
    const preprocessed = await preprocess(page, options)
    return streamAISDKCompletions<T>(this.client, preprocessed, schema, options)
  }

  // Pre-process the page and generate code
  async generate<T extends z.ZodSchema<any>>(
    page: Page,
    schema: T | Schema,
    options?: ScraperLLMOptions
  ) {
    const preprocessed = await preprocess(page, {
      format: 'html',
      ...options,
    })
    return generateAISDKCode<T>(this.client, preprocessed, schema, options)
  }
}
