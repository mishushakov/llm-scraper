import { type Page } from 'playwright'
import { LanguageModelV2 } from '@ai-sdk/provider'
import { type FlexibleSchema } from '@ai-sdk/provider-utils'

import { preprocess, PreProcessOptions } from './preprocess.js'
import {
  generateAISDKCompletions,
  streamAISDKCompletions,
  generateAISDKCode,
} from './models.js'

// Options for high-level LLM calls
export type ScraperLLMOptions = {
  prompt?: string
  temperature?: number
  maxOutputTokens?: number
  topP?: number
  mode?: 'auto' | 'json' | 'tool'
  output?: 'object' | 'array'
}

// Options for code generation
export type ScraperGenerateOptions = Omit<
  ScraperLLMOptions,
  'output' | 'mode'
> & {
  format?: 'html' | 'raw_html'
}

// Combined options for running scraper
export type ScraperRunOptions = ScraperLLMOptions & PreProcessOptions

export default class LLMScraper {
  constructor(private client: LanguageModelV2) {
    this.client = client
  }

  // Run the scraper end-to-end
  async run<S extends FlexibleSchema<unknown>>(
    page: Page,
    schema: S,
    options?: ScraperRunOptions
  ) {
    const preprocessed = await preprocess(page, options)
    return generateAISDKCompletions<S>(
      this.client,
      preprocessed,
      schema,
      options
    )
  }

  // Stream partial results from the scraper
  async stream<S extends FlexibleSchema<unknown>>(
    page: Page,
    schema: S,
    options?: ScraperRunOptions
  ) {
    const preprocessed = await preprocess(page, options)
    return streamAISDKCompletions<S>(this.client, preprocessed, schema, options)
  }

  // Generate scraping code instead of data
  async generate<S extends FlexibleSchema<unknown>>(
    page: Page,
    schema: S,
    options?: ScraperGenerateOptions
  ) {
    const preprocessed = await preprocess(page, options)
    return generateAISDKCode<S>(this.client, preprocessed, schema, options)
  }
}
