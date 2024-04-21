import { LanguageModelV1 } from '@ai-sdk/provider'
import { experimental_generateObject, UserContent } from 'ai'
import { z } from 'zod'
import { ScraperLoadResult } from './index.js'
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
  'You are a satistified web scraper. Extract the contents of the webpage'

function prepareOpenAIPage(page: ScraperLoadResult): UserContent {
  if (page.mode === 'image') {
    return [
      {
        type: 'image',
        image: page.content,
      },
    ]
  }

  return [{ type: 'text', text: page.content }]
}

export async function generateOpenAICompletions<T extends z.ZodSchema<any>>(
  model: LanguageModelV1,
  page: ScraperLoadResult,
  schema: T,
  prompt: string = defaultPrompt,
  temperature?: number
): Promise<ScraperCompletionResult<T>> {
  const content = prepareOpenAIPage(page)
  const data = await experimental_generateObject({
    model,
    schema,
    messages: [
      {
        role: 'assistant',
        content: prompt,
      },
      { role: 'user', content },
    ],
    temperature,
  })

  return {
    data,
    url: page.url,
  }
}

export async function generateLlamaCompletions<T extends z.ZodSchema<any>>(
  model: LlamaModel,
  page: ScraperLoadResult,
  schema: T,
  prompt: string = defaultPrompt,
  temperature?: number
): Promise<ScraperCompletionResult<T>> {
  const generatedSchema = zodToJsonSchema(schema)
  const grammar = new LlamaJsonSchemaGrammar(generatedSchema as GbnfJsonSchema) as any // any, because it has type inference going wild
  const context = new LlamaContext({ model })
  const session = new LlamaChatSession({ context })
  const pagePrompt = `${prompt}\n${page.content}`

  const result = await session.prompt(pagePrompt, {
    grammar,
    temperature,
  })

  const parsed = grammar.parse(result)
  return {
    data: parsed,
    url: page.url,
  }
}
