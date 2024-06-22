import { LanguageModelV1 } from '@ai-sdk/provider'
import { generateObject, UserContent } from 'ai'
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
  data: z.infer<T> | null
  url: string
}

const defaultPrompt =
  'You are a sophisticated web scraper. Extract the contents of the webpage'

function prepareAISDKPage(
  prompt: string,
  page: ScraperLoadResult
): UserContent {
  if (page.mode === 'image') {
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
  options: ScraperLLMOptions<T>
) {
  const content = prepareAISDKPage(options.prompt || defaultPrompt, page)
  const result = await generateObject({
    model,
    messages: [{ role: 'user', content }],
    schema: options.schema,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    topP: options.topP,
  })

  return {
    data: result.object,
    url: page.url,
  }
}

export async function generateLlamaCompletions<T extends z.ZodSchema<any>>(
  model: LlamaModel,
  page: ScraperLoadResult,
  options: ScraperLLMOptions<T>
): Promise<ScraperCompletionResult<T>> {
  const generatedSchema = zodToJsonSchema(options.schema) as GbnfJsonSchema
  const grammar = new LlamaJsonSchemaGrammar(generatedSchema) as any // any, because it has type inference going wild
  const context = new LlamaContext({ model })
  const session = new LlamaChatSession({ context })
  const pagePrompt = `${prompt}\n${page.content}`

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
