import { type Page } from 'playwright'
import { type LanguageModel, type Output, type Prompt, type CallSettings, ModelMessage } from 'ai'

import { preprocess, PreProcessOptions } from './preprocess.js'
import {
  generateAISDKCompletions,
  streamAISDKCompletions,
  generateAISDKCode,
} from './models.js'

// Options for high-level LLM calls
export type ScraperLLMOptions = CallSettings & {
  system?: string
  messages?: ModelMessage[]
}

// Options for code generation
export type ScraperGenerateOptions = Omit<ScraperLLMOptions, 'mode'> & {
  format?: 'html' | 'raw_html'
}

type ScraperRunOptions = ScraperLLMOptions & PreProcessOptions

export default class LLMScraper {
  constructor(private client: LanguageModel) {
    this.client = client
  }

  async run<OUTPUT extends Output.Output = Output.Output<string, string>>(
    page: Page,
    output: OUTPUT,
    options?: ScraperRunOptions
  ) {
    const preprocessed = await preprocess(page, options)
    return generateAISDKCompletions<OUTPUT>(this.client, preprocessed, output, options)
  }

  async stream<OUTPUT extends Output.Output = Output.Output<string, string>>(
    page: Page,
    output: OUTPUT,
    options?: ScraperRunOptions
  ) {
    const preprocessed = await preprocess(page, options)
    return streamAISDKCompletions<OUTPUT>(this.client, preprocessed, output, options)
  }

  // Generate scraping code instead of data
  async generate<OUTPUT extends Output.Output = Output.Output<string, string>>(
    page: Page,
    output: OUTPUT,
    options?: ScraperGenerateOptions
  ) {
    const preprocessed = await preprocess(page, options)
    return generateAISDKCode(this.client, preprocessed, output, options)
  }
}
