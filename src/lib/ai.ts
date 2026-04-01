import type { ChatMessage, ChatStreamRequest, StreamChunk } from '../../shared/api';
import type { ProviderCatalogId } from '../../shared/modelCatalog';
import { streamBackendChat } from './backendApi';

export type AIMessage = ChatMessage;
export type AIAttachment = NonNullable<ChatMessage['attachments']>[number];
export type { StreamChunk } from '../../shared/api';

export interface StreamTextParams {
  providerId: ProviderCatalogId;
  model: string;
  messages: AIMessage[];
  systemInstruction?: string;
}

export async function* streamText({
  providerId,
  model,
  messages,
  systemInstruction,
}: StreamTextParams): AsyncGenerator<StreamChunk> {
  const payload: ChatStreamRequest = {
    providerId,
    model,
    messages,
    systemInstruction,
  };

  yield* streamBackendChat(payload);
}
