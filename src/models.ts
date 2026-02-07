import { LanguageModelV2, JSONValue } from '@ai-sdk/provider'
import {
  DeepPartial,
  generateObject,
  generateText,
  streamObject,
  UserContent,
} from 'ai'
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

type ObjectOutputMode = 'object' | 'array' | 'no-schema'
type StreamItem<
  SCHEMA extends FlexibleSchema<unknown>,
  OUTPUT extends ObjectOutputMode
> = OUTPUT extends 'array'
  ? Array<InferSchema<SCHEMA>>
  : DeepPartial<InferSchema<SCHEMA>>

function stripMarkdownBackticks(text: string) {
  let trimmed = text.trim()
  trimmed = trimmed.replace(/^```(?:javascript)?\s*/i, '')
  trimmed = trimmed.replace(/\s*```$/i, '')
  return trimmed
}

function resolveObjectOutputMode(output?: ObjectOutputMode): ObjectOutputMode {
  return output ?? 'object'
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
  OUTPUT extends 'object' | 'array' | 'no-schema' = 'object'
>(
  model: LanguageModelV2,
  page: PreProcessResult,
  schema: SCHEMA,
  options?: ScraperLLMOptions & { output?: OUTPUT }
) {
  const content = prepareAISDKPage(page)

  const output = resolveObjectOutputMode(options?.output)
  const messages = [
    { role: 'system' as const, content: options?.prompt || defaultPrompt },
    { role: 'user' as const, content },
  ]
  const baseOptions = {
    model,
    messages,
    temperature: options?.temperature,
    maxOutputTokens: options?.maxOutputTokens,
    topP: options?.topP,
  }

  const result =
    output === 'no-schema'
      ? await generateObject({
          ...baseOptions,
          output: 'no-schema',
        })
      : await generateObject({
          ...baseOptions,
          schema,
          output,
        })

  return {
    data: result.object,
    url: page.url,
  }
}

export function streamAISDKCompletions<
  SCHEMA extends FlexibleSchema<unknown> = FlexibleSchema<JSONValue>,
  OUTPUT extends 'object' | 'array' | 'no-schema' = 'object'
>(
  model: LanguageModelV2,
  page: PreProcessResult,
  schema: SCHEMA,
  options?: ScraperLLMOptions & { output?: OUTPUT }
): { stream: AsyncIterable<StreamItem<SCHEMA, OUTPUT>>; url: string } {
  const content = prepareAISDKPage(page)

  const output = resolveObjectOutputMode(options?.output)
  const messages = [
    { role: 'system' as const, content: options?.prompt || defaultPrompt },
    { role: 'user' as const, content },
  ]
  const baseOptions = {
    model,
    messages,
    temperature: options?.temperature,
    maxOutputTokens: options?.maxOutputTokens,
    topP: options?.topP,
  }

  const { partialObjectStream } =
    output === 'no-schema'
      ? streamObject({
          ...baseOptions,
          output: 'no-schema',
        })
      : streamObject({
          ...baseOptions,
          schema,
          output,
        })

  return {
    stream: partialObjectStream as AsyncIterable<StreamItem<SCHEMA, OUTPUT>>,
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
