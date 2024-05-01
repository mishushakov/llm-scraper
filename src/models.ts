import OpenAI from 'openai'
import { z } from 'zod'
import { ScraperLoadResult } from './index.js'
import {
  LlamaModel,
  LlamaJsonSchemaGrammar,
  LlamaContext,
  LlamaChatSession,
  GbnfJsonSchema,
} from 'node-llama-cpp'
import { JsonSchema7Type } from 'zod-to-json-schema'
import { error } from 'console'

export type ScraperCompletionResult<T extends z.ZodSchema<any>> = {
  data: z.infer<T> | null
  url: string
  error: any
}

const defaultPrompt =
  'You are a satistified web scraper. Extract the contents of the webpage'

function prepareOpenAIPage(
  page: ScraperLoadResult
): OpenAI.Chat.Completions.ChatCompletionContentPart[] {
  if (page.mode === 'image') {
    return [
      {
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${page.content}` },
      },
    ]
  }

  return [{ type: 'text', text: page.content }]
}

export async function generateOpenAICompletions<T extends z.ZodSchema<any>>(
  client: OpenAI,
  model: string = 'gpt-3.5-turbo',
  page: ScraperLoadResult,
  schema: JsonSchema7Type,
  prompt: string = defaultPrompt,
  temperature?: number
): Promise<ScraperCompletionResult<T>> {
  const openai = client as OpenAI
  const content = prepareOpenAIPage(page)

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: prompt,
      },
      { role: 'user', content },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'extract_content',
          description: 'Extracts the content from the given webpage(s)',
          parameters: schema,
        },
      },
    ],
    tool_choice: 'auto',
    temperature,
  })
  let c: any
  let errorMessage: any
  try {
    c = JSON.parse(completion.choices[0].message.tool_calls[0].function.arguments)
  } catch (e) {
    console.error('Error parsing OpenAI completion', e)
    e ? errorMessage = JSON.stringify(e) : errorMessage = "Something went wrong"
    c = completion.choices[0].message.content
  }

  return {
    data: c,
    url: page.url,
    error: errorMessage,
  }
}

export async function generateLlamaCompletions<T extends z.ZodSchema<any>>(
  model: LlamaModel,
  page: ScraperLoadResult,
  schema: JsonSchema7Type,
  prompt: string = defaultPrompt,
  temperature?: number
): Promise<ScraperCompletionResult<T>> {
  const grammar = new LlamaJsonSchemaGrammar(schema as GbnfJsonSchema) as any // any, because it has weird type inference going on
  const context = new LlamaContext({ model })
  const session = new LlamaChatSession({ context })
  const pagePrompt = `${prompt}\n${page.content}`
  let result: string
  let errorMessage: any
  try {
    result = await session.prompt(pagePrompt, {
      grammar,
      temperature,
    })
  } catch (e) {
    console.error('Error generating Llama completions', e)
    e ? errorMessage = JSON.stringify(e) : errorMessage = "Something went wrong"
    result = "Error"
  }


  const parsed = grammar.parse(result)
  return {
    data: parsed,
    url: page.url,
    error: errorMessage,
  }
}
