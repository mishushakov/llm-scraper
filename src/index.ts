import { type Page } from 'playwright'
import { type LanguageModel, type Output } from 'ai'
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
}

// Options for code generation
export type ScraperGenerateOptions = Omit<ScraperLLMOptions, 'mode'> & {
  format?: 'html' | 'raw_html'
}

type ScraperRunOptions<OUTPUT extends Output.Output = Output.Output<string, string>> =
  ScraperLLMOptions & PreProcessOptions & { output: OUTPUT }

export default class LLMScraper {
  constructor(private client: LanguageModel) {
    this.client = client
  }

  async run<OUTPUT extends Output.Output = Output.Output<string, string>>(
    page: Page,
    options: ScraperRunOptions<OUTPUT>
  ) {
    const preprocessed = await preprocess(page, options)
    return generateAISDKCompletions<OUTPUT>(this.client, preprocessed, options)
  }

  async stream<OUTPUT extends Output.Output = Output.Output<string, string>>(
    page: Page,
    options: ScraperRunOptions<OUTPUT>
  ) {
    const preprocessed = await preprocess(page, options)
    return streamAISDKCompletions<OUTPUT>(this.client, preprocessed, options)
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
