import { LanguageModelV2, JSONValue } from '@ai-sdk/provider'
import { generateObject, generateText, streamObject, UserContent } from 'ai'
import {
  type FlexibleSchema,
  InferSchema,
  asSchema,
} from '@ai-sdk/provider-utils'
import { ScraperLLMOptions, ScraperGenerateOptions } from './index.js'
import { PreProcessResult } from './preprocess.js'

const defaultPrompt =
  'You are a sophisticated web scraper. Extract the contents of the webpage'

const defaultCodePrompt =
  "Provide a scraping function in JavaScript that extracts and returns data according to a schema from the current page. The function must be IIFE. No comments or imports. No console.log. The code you generate will be executed straight away, you shouldn't output anything besides runnable code."

function stripMarkdownBackticks(text: string) {
  let trimmed = text.trim()
  trimmed = trimmed.replace(/^```(?:javascript)?\s*/i, '')
  trimmed = trimmed.replace(/\s*```$/i, '')
  return trimmed
}

function prepareAISDKPage(page: PreProcessResult): UserContent {
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

export async function generateAISDKCompletions<
  SCHEMA extends FlexibleSchema<unknown> = FlexibleSchema<JSONValue>,
  OUTPUT extends
    | 'object'
    | 'array'
    | 'enum'
    | 'no-schema' = InferSchema<SCHEMA> extends string ? 'enum' : 'object'
>(
  model: LanguageModelV2,
  page: PreProcessResult,
  schema: SCHEMA,
  options?: ScraperLLMOptions & { output?: OUTPUT }
) {
  const content = prepareAISDKPage(page)

  const result = await generateObject({
    model,
    messages: [
      { role: 'system', content: options?.prompt || defaultPrompt },
      { role: 'user', content },
    ],
    schema: schema,
    temperature: options?.temperature,
    maxOutputTokens: options?.maxOutputTokens,
    topP: options?.topP,
    mode: options?.mode,
    output: options?.output,
  })

  return {
    data: result.object,
    url: page.url,
  }
}

export function streamAISDKCompletions<
  SCHEMA extends FlexibleSchema<unknown> = FlexibleSchema<JSONValue>,
  OUTPUT extends
    | 'object'
    | 'array'
    | 'enum'
    | 'no-schema' = InferSchema<SCHEMA> extends string ? 'enum' : 'object'
>(
  model: LanguageModelV2,
  page: PreProcessResult,
  schema: SCHEMA,
  options?: ScraperLLMOptions & { output?: OUTPUT }
) {
  const content = prepareAISDKPage(page)

  const { partialObjectStream } = streamObject({
    model,
    messages: [
      { role: 'system', content: options?.prompt || defaultPrompt },
      { role: 'user', content },
    ],
    schema,
    temperature: options?.temperature,
    maxOutputTokens: options?.maxOutputTokens,
    topP: options?.topP,
    mode: options?.mode,
    output: options?.output,
  })

  return {
    stream: partialObjectStream,
    url: page.url,
  }
}

export async function generateAISDKCode<S extends FlexibleSchema<unknown>>(
  model: LanguageModelV2,
  page: PreProcessResult,
  schema: S,
  options?: ScraperGenerateOptions
) {
  const aiSchema = asSchema(schema)
  const parsedSchema = aiSchema.jsonSchema

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
    maxOutputTokens: options?.maxOutputTokens,
    topP: options?.topP,
  })

  return {
    code: stripMarkdownBackticks(result.text),
    url: page.url,
  }
}
