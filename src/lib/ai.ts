export type AIProtocol = 'gemini' | 'openai-compatible';

export interface AIMessage {
  role: 'user' | 'model' | 'system';
  content: string;
  attachments?: AIAttachment[];
}

export interface AIAttachment {
  id: string;
  name: string;
  mimeType: string;
  kind: 'image' | 'document';
  dataUrl?: string;
  base64Data?: string;
}

export interface StreamTextParams {
  protocol: AIProtocol;
  model: string;
  messages: AIMessage[];
  apiKey?: string;
  baseUrl?: string;
  systemInstruction?: string;
}

export interface StreamChunk {
  type: 'content' | 'reasoning';
  text: string;
}

function getOpenAICompatibleEndpoint(baseUrl?: string) {
  if (!baseUrl) {
    throw new Error('Missing OPENAI_COMPATIBLE_BASE_URL.');
  }

  return `${baseUrl.replace(/\/$/, '')}/chat/completions`;
}

function toOpenAIMessages(messages: AIMessage[], systemInstruction?: string) {
  const normalized = messages.map((message) => ({
    role: message.role === 'model' ? 'assistant' : message.role,
    content: toOpenAIContent(message),
  }));

  if (systemInstruction) {
    return [{ role: 'system', content: systemInstruction }, ...normalized];
  }

  return normalized;
}

function toOpenAIContent(message: AIMessage) {
  const attachments = message.attachments ?? [];
  if (attachments.length === 0) {
    return message.content;
  }

  const content: any[] = [];
  if (message.content.trim()) {
    content.push({ type: 'text', text: message.content });
  }

  for (const attachment of attachments) {
    if (attachment.kind === 'image' && attachment.dataUrl) {
      content.push({
        type: 'image_url',
        image_url: {
          url: attachment.dataUrl,
        },
      });
      continue;
    }

    if (attachment.base64Data) {
      content.push({
        type: 'file',
        file: {
          filename: attachment.name,
          file_data: attachment.base64Data,
        },
      });
    }
  }

  return content;
}

async function* streamGeminiTextInternal({ model, messages, systemInstruction, apiKey }: StreamTextParams): AsyncGenerator<StreamChunk> {
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY.');
  }

  const { GoogleGenAI } = await import('@google/genai');
  const geminiClient = new GoogleGenAI({ apiKey });

  const contents = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'model' ? 'model' : 'user',
      parts: toGeminiParts(message),
    }));

  const responseStream = await geminiClient.models.generateContentStream({
    model,
    config: systemInstruction ? { systemInstruction } : undefined,
    contents,
  });

  for await (const chunk of responseStream) {
    if (chunk.text) {
      yield {
        type: 'content',
        text: chunk.text,
      };
    }
  }
}

function toGeminiParts(message: AIMessage) {
  const parts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  > = [];

  if (message.content.trim()) {
    parts.push({ text: message.content });
  }

  for (const attachment of message.attachments ?? []) {
    if (!attachment.base64Data) continue;
    parts.push({
      inlineData: {
        mimeType: attachment.mimeType,
        data: attachment.base64Data,
      },
    });
  }

  if (parts.length === 0) {
    parts.push({ text: '' });
  }

  return parts;
}

function flattenTextValue(value: unknown): string {
  if (!value) return '';

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => flattenTextValue(item)).join('');
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;

    if (typeof record.text === 'string') {
      return record.text;
    }

    if (typeof record.content === 'string') {
      return record.content;
    }

    if (typeof record.output_text === 'string') {
      return record.output_text;
    }
  }

  return '';
}

function extractContentDelta(delta: Record<string, unknown>) {
  return flattenTextValue(delta.content);
}

function extractReasoningDelta(delta: Record<string, unknown>) {
  return (
    flattenTextValue(delta.reasoning_content) ||
    flattenTextValue(delta.reasoning) ||
    flattenTextValue(delta.reasoning_text) ||
    flattenTextValue(delta.thinking)
  );
}

async function* streamOpenAICompatibleTextInternal({ model, messages, systemInstruction, apiKey, baseUrl }: StreamTextParams): AsyncGenerator<StreamChunk> {
  if (!apiKey) {
    throw new Error('Missing OPENAI_COMPATIBLE_API_KEY.');
  }

  const response = await fetch(getOpenAICompatibleEndpoint(baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: toOpenAIMessages(messages, systemInstruction),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI-compatible request failed: ${response.status} ${errorText}`);
  }

  if (!response.body) {
    throw new Error('OpenAI-compatible response body is empty.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) continue;

      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;

      const parsed = JSON.parse(data);
      const delta = parsed.choices?.[0]?.delta ?? {};
      const reasoningText = extractReasoningDelta(delta);
      const text = extractContentDelta(delta);

      if (reasoningText) {
        yield {
          type: 'reasoning',
          text: reasoningText,
        };
      }

      if (text) {
        yield {
          type: 'content',
          text,
        };
      }
    }

    if (done) {
      break;
    }
  }
}

export function streamText(params: StreamTextParams) {
  if (params.protocol === 'gemini') {
    return streamGeminiTextInternal(params);
  }

  return streamOpenAICompatibleTextInternal(params);
}
