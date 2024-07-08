import { LanguageModelV1 } from '@ai-sdk/provider'
import { generateObject, streamObject, UserContent } from 'ai'
import { z } from 'zod'
import { ScraperLoadResult, ScraperLLMOptions } from './index.js'
import {
  LlamaModel,
  LlamaJsonSchemaGrammar,
  LlamaContext,
  LlamaChatSession,
  GbnfJsonSchema,
} from 'node-llama-cpp'
import { zodToJsonSchema } from 'zod-to-json-schema'

export type ScraperCompletionResult<T extends z.ZodSchema<any>> = {
  data: z.infer<T>
  url: string
}

const defaultPrompt =
  'You are a sophisticated web scraper. Extract the contents of the webpage'

function prepareAISDKPage(
  prompt: string,
  page: ScraperLoadResult
): UserContent {
  if (page.format === 'image') {
    return [
      { type: 'text', text: prompt },
      {
        type: 'image',
        image: page.content,
      },
    ]
  }

  return [
    { type: 'text', text: prompt },
    { type: 'text', text: page.content },
  ]
}

export async function generateAISDKCompletions<T extends z.ZodSchema<any>>(
  model: LanguageModelV1,
  page: ScraperLoadResult,
  schema: T,
  options: ScraperLLMOptions
) {
  const content = prepareAISDKPage(options.prompt || defaultPrompt, page)
  const result = await generateObject<z.infer<T>>({
    model,
    messages: [{ role: 'user', content }],
    schema,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    topP: options.topP,
  })

  return {
    data: result.object,
    url: page.url,
  }
}

export async function streamAISDKCompletions<T extends z.ZodSchema<any>>(
  model: LanguageModelV1,
  page: ScraperLoadResult,
  schema: T,
  options: ScraperLLMOptions
) {
  const content = prepareAISDKPage(options.prompt || defaultPrompt, page)
  const { partialObjectStream } = await streamObject<z.infer<T>>({
    model,
    messages: [{ role: 'user', content }],
    schema,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    topP: options.topP,
  })

  return {
    stream: partialObjectStream,
    url: page.url,
  }
}

export async function generateLlamaCompletions<T extends z.ZodSchema<any>>(
  model: LlamaModel,
  page: ScraperLoadResult,
  schema: T,
  options: ScraperLLMOptions
): Promise<ScraperCompletionResult<T>> {
  const generatedSchema = zodToJsonSchema(schema) as GbnfJsonSchema
  const grammar = new LlamaJsonSchemaGrammar(generatedSchema) as any // any, because it has type inference going wild
  const context = new LlamaContext({ model })
  const session = new LlamaChatSession({ context })
  const pagePrompt = `${options.prompt || defaultPrompt}\n${page.content}`

  const result = await session.prompt(pagePrompt, {
    grammar,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    topP: options.topP,
  })

  const parsed = grammar.parse(result)
  return {
    data: parsed,
    url: page.url,
  }
}
