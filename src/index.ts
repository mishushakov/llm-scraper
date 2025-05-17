import { type Page } from 'playwright'
import { LanguageModelV1 } from '@ai-sdk/provider'
import { z } from 'zod'
import { Schema } from 'ai'
import {
  generateAISDKCompletions,
  streamAISDKCompletions,
  generateAISDKCode,
} from './models.js'
import {
  preprocess,
  PreProcessOptions,
  PreProcessResult,
} from './preprocess.js'

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

  // Generate completion using AI SDK
  private async generateCompletions<T extends z.ZodSchema<any>>(
    page: PreProcessResult,
    schema: T | Schema,
    options?: ScraperRunOptions
  ) {
    return generateAISDKCompletions<T>(this.client, page, schema, options)
  }

  // Stream completions using AI SDK
  private async streamCompletions<T extends z.ZodSchema<any>>(
    page: PreProcessResult,
    schema: T | Schema,
    options?: ScraperRunOptions
  ) {
    return streamAISDKCompletions<T>(this.client, page, schema, options)
  }

  private async generateCode<T extends z.ZodSchema<any>>(
    page: PreProcessResult,
    schema: T | Schema,
    options?: ScraperLLMOptions
  ) {
    return generateAISDKCode<T>(this.client, page, schema, options)
  }

  // Pre-process the page and generate completion
  async run<T extends z.ZodSchema<any>>(
    page: Page,
    schema: T | Schema,
    options?: ScraperRunOptions
  ) {
    const preprocessed = await preprocess(page, options)
    return this.generateCompletions<T>(preprocessed, schema, options)
  }

  // Pre-process the page and stream completion
  async stream<T extends z.ZodSchema<any>>(
    page: Page,
    schema: T | Schema,
    options?: ScraperRunOptions
  ) {
    const preprocessed = await preprocess(page, options)
    return this.streamCompletions<T>(preprocessed, schema, options)
  }

  // Pre-process the page and generate code
  async generate(
    page: Page,
    schema: z.ZodSchema<any> | Schema,
    options?: ScraperLLMOptions
  ) {
    const preprocessed = await preprocess(page, {
      format: 'html',
      ...options,
    })
    return this.generateCode(preprocessed, schema, options)
  }
}
