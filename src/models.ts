import { LanguageModelV1 } from '@ai-sdk/provider'
import {
  generateObject,
  generateText,
  streamObject,
  UserContent,
  Schema,
} from 'ai'
import { z } from 'zod'
import { ScraperLoadResult, ScraperLLMOptions } from './index.js'
import { zodToJsonSchema } from 'zod-to-json-schema'

export type ScraperCompletionResult<T extends z.ZodSchema<any>> = {
  data: z.infer<T>
  url: string
}

const defaultPrompt =
  'You are a sophisticated web scraper. Extract the contents of the webpage'

const defaultCodePrompt = `Provide a scraping function in JavaScript that extracts and formats data according to a schema from the current page.
The function must be IIFE. No comments or imports. The code you generate will be executed straight away, you shouldn't output anything besides runnable code.`

function prepareAISDKPage(page: ScraperLoadResult): UserContent {
  if (page.format === 'image') {
    return [
      {
        type: 'image',
        image: page.content,
      },
    ]
  }

  return [{ type: 'text', text: page.content }]
}

export async function generateAISDKCompletions<T extends z.ZodSchema<any>>(
  model: LanguageModelV1,
  page: ScraperLoadResult,
  schema: T | Schema,
  options?: ScraperLLMOptions
) {
  const content = prepareAISDKPage(page)
  const result = await generateObject<z.infer<T>>({
    model,
    messages: [
      { role: 'system', content: options?.prompt || defaultPrompt },
      { role: 'user', content },
    ],
    schema,
    temperature: options?.temperature,
    maxTokens: options?.maxTokens,
    topP: options?.topP,
    mode: options?.mode,
    output: options?.output,
  })

  return {
    data: result.object,
    url: page.url,
  }
}

export async function streamAISDKCompletions<T extends z.ZodSchema<any>>(
  model: LanguageModelV1,
  page: ScraperLoadResult,
  schema: T | Schema,
  options?: ScraperLLMOptions
) {
  const content = prepareAISDKPage(page)
  const { partialObjectStream } = await streamObject<z.infer<T>>({
    model,
    messages: [
      { role: 'system', content: options?.prompt || defaultPrompt },
      { role: 'user', content },
    ],
    schema,
    output: options?.output,
    temperature: options?.temperature,
    maxTokens: options?.maxTokens,
    topP: options?.topP,
  })

  return {
    stream: partialObjectStream,
    url: page.url,
  }
}

export async function generateAISDKCode<T extends z.ZodSchema<any>>(
  model: LanguageModelV1,
  page: ScraperLoadResult,
  schema: T | Schema,
  options?: ScraperLLMOptions
) {
  const parsedSchema =
    schema instanceof z.ZodSchema ? zodToJsonSchema(schema) : schema

  const result = await generateText({
    model,
    messages: [
      { role: 'system', content: options?.prompt || defaultCodePrompt },
      {
        role: 'user',
        content: `Website: ${page.url}
        Schema: ${JSON.stringify(parsedSchema)}
        Content: ${page.content}`,
      },
    ],
    temperature: options?.temperature,
    maxTokens: options?.maxTokens,
    topP: options?.topP,
  })

  return {
    code: result.text,
    url: page.url,
  }
}
