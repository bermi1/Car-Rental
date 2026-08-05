import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env';

/**
 * AI assistance for the operations the staff actually do by hand today:
 * writing up damage after a return, summarising a handover, and answering
 * questions that used to mean opening a spreadsheet.
 *
 * Every function degrades gracefully. If no API key is configured the service
 * reports itself unavailable and callers fall back to manual entry — the AI
 * is an accelerator here, never a dependency.
 */

const MODEL = 'claude-opus-5';

let client: Anthropic | null = null;

export function aiEnabled(): boolean {
  return Boolean(env.anthropicApiKey);
}

function getClient(): Anthropic {
  if (!client) {
    if (!env.anthropicApiKey) throw new AiUnavailableError();
    client = new Anthropic({ apiKey: env.anthropicApiKey });
  }
  return client;
}

export class AiUnavailableError extends Error {
  status = 503;
  constructor() {
    super('AI assistance is not configured. Set ANTHROPIC_API_KEY to enable it.');
  }
}

/** Pulls the text out of a response, guarding against a safety refusal. */
function textOf(message: Anthropic.Message): string {
  if (message.stop_reason === 'refusal') {
    throw new Error('The assistant declined to answer this request.');
  }
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

/* ------------------------------ damage assist ----------------------------- */

export interface DamageSuggestion {
  description: string;
  severity: 'minor' | 'moderate' | 'severe';
  penalty_amount: number;
  reasoning: string;
}

const DAMAGE_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          severity: { type: 'string', enum: ['minor', 'moderate', 'severe'] },
          penalty_amount: { type: 'number' },
          reasoning: { type: 'string' },
        },
        required: ['description', 'severity', 'penalty_amount', 'reasoning'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
} as const;

/**
 * Turns a staff member's rough notes at check-out into itemised damage with a
 * suggested penalty for each. The output is a draft: staff edit the amounts
 * and the record is flagged `ai_assisted` so a reviewer knows how it was made.
 */
export async function suggestDamages(input: {
  notes: string;
  vehicle: string;
  fuelLevelOut?: string;
  fuelLevelIn?: string;
  mileageDriven?: number;
  lateDays?: number;
  rates: { lateReturnPerDay: number; fuelShortfall: number; dailyRate: number };
  language?: 'en' | 'sw';
}): Promise<DamageSuggestion[]> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4000,
    thinking: { type: 'adaptive' },
    output_config: { format: { type: 'json_schema', schema: DAMAGE_SCHEMA } },
    system: [
      'You help a Tanzanian car rental company assess vehicle damage at check-out.',
      'Itemise only what the notes actually describe — never invent damage.',
      'Amounts are in Tanzanian Shillings (TZS) and should be proportionate to the',
      'severity and to the rates you are given. Round to the nearest 1,000 TZS.',
      input.language === 'sw'
        ? 'Write the description and reasoning fields in Kiswahili.'
        : 'Write the description and reasoning fields in English.',
    ].join(' '),
    messages: [
      {
        role: 'user',
        content: [
          `Vehicle: ${input.vehicle}`,
          `Staff notes at check-out: ${input.notes}`,
          input.fuelLevelOut ? `Fuel at handover: ${input.fuelLevelOut}` : '',
          input.fuelLevelIn ? `Fuel at return: ${input.fuelLevelIn}` : '',
          input.mileageDriven !== undefined ? `Distance driven: ${input.mileageDriven} km` : '',
          input.lateDays ? `Returned ${input.lateDays} day(s) late` : '',
          '',
          'Company rates:',
          `- Late return fee: ${input.rates.lateReturnPerDay} TZS per day`,
          `- Fuel shortfall fee: ${input.rates.fuelShortfall} TZS`,
          `- Vehicle daily rate: ${input.rates.dailyRate} TZS`,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
  });

  const parsed = JSON.parse(textOf(response)) as { items: DamageSuggestion[] };
  return parsed.items ?? [];
}

/* ---------------------------- handover summary ---------------------------- */

/** Turns raw condition-report fields into a paragraph fit for the contract. */
export async function summariseHandover(input: {
  type: 'check_in' | 'check_out';
  vehicle: string;
  fuelLevel: string;
  mileage: number;
  notes?: string | null;
  photoCount: number;
  hasVideo: boolean;
  language?: 'en' | 'sw';
}): Promise<string> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'low' },
    system:
      'You write short, factual vehicle handover summaries for a car rental company. ' +
      'Two or three sentences, plain language, no bullet points, no preamble. ' +
      'State only what the data supports. ' +
      (input.language === 'sw' ? 'Write in Kiswahili.' : 'Write in English.'),
    messages: [
      {
        role: 'user',
        content: [
          `Report type: ${input.type === 'check_in' ? 'handover to client' : 'return from client'}`,
          `Vehicle: ${input.vehicle}`,
          `Fuel level: ${input.fuelLevel}`,
          `Odometer: ${input.mileage} km`,
          `Evidence: ${input.photoCount} photo(s)${input.hasVideo ? ' and a walkaround video' : ''}`,
          input.notes ? `Notes: ${input.notes}` : 'Notes: none recorded',
        ].join('\n'),
      },
    ],
  });

  return textOf(response);
}

/* ------------------------------- ops answers ------------------------------ */

/**
 * Answers a plain-language question about the company's current position from
 * a snapshot of its own figures — the thing staff previously did by filtering
 * a spreadsheet. The snapshot is assembled by the caller so the model only
 * ever sees aggregates for the one company asking.
 */
export async function answerOperationsQuestion(input: {
  question: string;
  snapshot: Record<string, unknown>;
  companyName: string;
  language?: 'en' | 'sw';
}): Promise<string> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1500,
    thinking: { type: 'adaptive' },
    system: [
      `You answer operational questions for ${input.companyName}, a car rental company in Tanzania,`,
      'using only the JSON snapshot of their data provided in the user message.',
      'Answer in two or three sentences with the specific numbers that support it.',
      'If the snapshot does not contain what the question needs, say so plainly and',
      'name which screen in the console would show it — do not guess.',
      'Amounts are Tanzanian Shillings (TZS).',
      input.language === 'sw' ? 'Answer in Kiswahili.' : 'Answer in English.',
    ].join(' '),
    messages: [
      {
        role: 'user',
        content: `Question: ${input.question}\n\nCurrent data:\n${JSON.stringify(
          input.snapshot,
          null,
          2
        )}`,
      },
    ],
  });

  return textOf(response);
}
