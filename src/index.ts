import { type Page } from 'playwright'
import { LanguageModelV2 } from '@ai-sdk/provider'
import { type FlexibleSchema, InferSchema } from '@ai-sdk/provider-utils'

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
}

// Options for code generation
export type ScraperGenerateOptions = Omit<ScraperLLMOptions, 'mode'> & {
  format?: 'html' | 'raw_html'
}

export default class LLMScraper {
  constructor(private client: LanguageModelV2) {
    this.client = client
  }

  // Run the scraper end-to-end
  async run<
    SCHEMA extends FlexibleSchema<unknown>,
    OUTPUT extends
      | 'object'
      | 'array'
      | 'enum'
      | 'no-schema' = InferSchema<SCHEMA> extends string ? 'enum' : 'object'
  >(
    page: Page,
    schema: SCHEMA,
    options?: ScraperLLMOptions & { output?: OUTPUT } & PreProcessOptions
  ) {
    const preprocessed = await preprocess(page, options)
    return generateAISDKCompletions<SCHEMA, OUTPUT>(
      this.client,
      preprocessed,
      schema,
      options
    )
  }

  // Stream partial results from the scraper
  async stream<
    S extends FlexibleSchema<unknown>,
    OUTPUT extends
      | 'object'
      | 'array'
      | 'enum'
      | 'no-schema' = InferSchema<S> extends string ? 'enum' : 'object'
  >(
    page: Page,
    schema: S,
    options?: ScraperLLMOptions & { output?: OUTPUT } & PreProcessOptions
  ) {
    const preprocessed = await preprocess(page, options)
    return streamAISDKCompletions<S, OUTPUT>(
      this.client,
      preprocessed,
      schema,
      options
    )
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
