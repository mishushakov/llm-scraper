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

export type ScraperGenerateOptions = Omit<
  ScraperLLMOptions,
  'output' | 'mode'
>

export type ScraperRunOptions = ScraperLLMOptions & PreProcessOptions

export default class LLMScraper {
  constructor(private client: LanguageModelV1) {
    this.client = client
  }

  // Pre-process the page and generate completion
  async run<T>(
    page: Page,
    schema: z.Schema<T, z.ZodTypeDef, any> | Schema<T>,
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
  async stream<T>(
    page: Page,
    schema: z.Schema<T, z.ZodTypeDef, any> | Schema<T>,
    options?: ScraperRunOptions
  ) {
    const preprocessed = await preprocess(page, options)
    return streamAISDKCompletions<T>(this.client, preprocessed, schema, options)
  }

  // Pre-process the page and generate code
  async generate<T>(
    page: Page,
    schema: z.Schema<T, z.ZodTypeDef, any> | Schema<T>,
    options?: ScraperGenerateOptions
  ) {
    const preprocessed = await preprocess(page, {
      format: 'raw_html',
      ...options,
    })
    return generateAISDKCode<T>(this.client, preprocessed, schema, options)
  }
}
