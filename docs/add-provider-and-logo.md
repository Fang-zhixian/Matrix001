# Add a New AI Provider, Model, and Logo

This project has three separate responsibilities when you add a new model provider:

1. Register the provider logo
2. Register the provider and its models
3. Add default config storage for that provider

If you only add a new model under an existing provider, you usually only need to modify `src/lib/modelCatalog.ts`.

## File Map

- Logo assets: [src/assets/provider-logos](/Users/zhixian/Desktop/gemini-canvas2/src/assets/provider-logos)
- Asset type declarations: [src/assets.d.ts](/Users/zhixian/Desktop/gemini-canvas2/src/assets.d.ts)
- Provider logo rendering: [src/components/ProviderMark.tsx](/Users/zhixian/Desktop/gemini-canvas2/src/components/ProviderMark.tsx)
- Provider/model catalog: [src/lib/modelCatalog.ts](/Users/zhixian/Desktop/gemini-canvas2/src/lib/modelCatalog.ts)
- Persisted provider config: [src/store.ts](/Users/zhixian/Desktop/gemini-canvas2/src/store.ts)
- Runtime protocol support: [src/lib/ai.ts](/Users/zhixian/Desktop/gemini-canvas2/src/lib/ai.ts)

## 1. Upload the Logo File

Put the provider logo file into:

- [src/assets/provider-logos](/Users/zhixian/Desktop/gemini-canvas2/src/assets/provider-logos)

Current project asset imports already support:

- `svg`
- `ico`

If you want to use another format such as `png` or `webp`, add a matching module declaration in:

- [src/assets.d.ts](/Users/zhixian/Desktop/gemini-canvas2/src/assets.d.ts)

Example:

```ts
declare module '*.png' {
  const src: string;
  export default src;
}
```

## 2. Register the Logo in `ProviderMark`

Open:

- [src/components/ProviderMark.tsx](/Users/zhixian/Desktop/gemini-canvas2/src/components/ProviderMark.tsx)

Do two things:

1. Import the file
2. Add it to `PROVIDER_LOGOS`

Example:

```tsx
import newProviderLogo from '../assets/provider-logos/newprovider.svg';

const PROVIDER_LOGOS = {
  // ...
  newprovider: {
    src: newProviderLogo,
    alt: 'NewProvider',
  },
};
```

The `newprovider` key must match the provider id you define in `modelCatalog.ts`.

## 3. Add the Provider and Its Models

Open:

- [src/lib/modelCatalog.ts](/Users/zhixian/Desktop/gemini-canvas2/src/lib/modelCatalog.ts)

### 3.1 Add the provider id

Extend `ProviderCatalogId`:

```ts
export type ProviderCatalogId =
  | 'gemini'
  | 'deepseek'
  | 'qwen'
  | 'moonshot'
  | 'zhipu'
  | 'newprovider';
```

### 3.2 Add a provider entry

Add a new object to `PROVIDER_CATALOG`.

OpenAI-compatible provider example:

```ts
{
  id: 'newprovider',
  label: 'NewProvider',
  protocol: 'openai-compatible',
  description: 'NewProvider OpenAI-compatible API',
  apiKeyLabel: 'NewProvider API Key',
  apiKeyPlaceholder: 'Paste your NewProvider API key',
  baseUrlLabel: 'API Base URL',
  baseUrlPlaceholder: 'https://api.newprovider.com/v1',
  defaultBaseUrl: 'https://api.newprovider.com/v1',
  models: [
    {
      id: 'newprovider-chat',
      label: 'NewProvider Chat',
      description: 'General chat model',
    },
    {
      id: 'newprovider-vision',
      label: 'NewProvider Vision',
      description: 'Vision-capable model',
      capabilities: { image: true, pdf: true },
    },
  ],
}
```

Gemini-native style provider example:

```ts
{
  id: 'newprovider',
  label: 'NewProvider Native',
  protocol: 'gemini',
  description: 'Native API',
  apiKeyLabel: 'NewProvider API Key',
  apiKeyPlaceholder: 'Paste your API key',
  models: [
    {
      id: 'newprovider-fast',
      label: 'NewProvider Fast',
      description: 'Fast default model',
    },
  ],
}
```

### 3.3 Capability flags

If a model supports multimodal input, set its capabilities:

```ts
capabilities: {
  image: true,
  pdf: true,
}
```

These flags drive upload availability and model capability checks in the UI.

## 4. Add Default Config Storage

Open:

- [src/store.ts](/Users/zhixian/Desktop/gemini-canvas2/src/store.ts)

Find `providerConfigs` in the initial store state and add your provider:

```ts
providerConfigs: {
  // ...
  newprovider: {
    apiKey: '',
    baseUrl: getDefaultBaseUrlForProvider('newprovider'),
  },
}
```

If the provider is not OpenAI-compatible and does not use a base URL, set:

```ts
baseUrl: '',
```

## 5. When You Only Want to Add a New Model

If the provider already exists, you only need to edit:

- [src/lib/modelCatalog.ts](/Users/zhixian/Desktop/gemini-canvas2/src/lib/modelCatalog.ts)

Add a new item to that provider's `models` array:

```ts
{
  id: 'qwen-new-model',
  label: 'Qwen New Model',
  description: 'Short description',
  capabilities: { image: true },
}
```

No logo change is needed in this case.

## 6. If the Runtime Protocol Is New

Right now the runtime only supports two protocols:

- `gemini`
- `openai-compatible`

That logic is implemented in:

- [src/lib/ai.ts](/Users/zhixian/Desktop/gemini-canvas2/src/lib/ai.ts)

If a new provider cannot use either of those protocols, you need to extend:

- `AIProtocol`
- request formatting
- streaming logic
- attachment conversion logic

If the provider exposes a standard OpenAI-compatible `/chat/completions` endpoint, you do not need to change `src/lib/ai.ts`.

## 7. Recommended Checklist

After adding a provider or model:

1. Run `npm run lint`
2. Run `npm run build`
3. Open Settings and confirm the provider appears
4. Confirm the logo appears in both Settings and the bottom model picker
5. Confirm API key and base URL can be saved
6. Send one real test message

## 8. Minimal Change Sets

### Add only a model

Change:

- [src/lib/modelCatalog.ts](/Users/zhixian/Desktop/gemini-canvas2/src/lib/modelCatalog.ts)

### Add a new provider that is OpenAI-compatible

Change:

- [src/assets/provider-logos](/Users/zhixian/Desktop/gemini-canvas2/src/assets/provider-logos)
- [src/components/ProviderMark.tsx](/Users/zhixian/Desktop/gemini-canvas2/src/components/ProviderMark.tsx)
- [src/lib/modelCatalog.ts](/Users/zhixian/Desktop/gemini-canvas2/src/lib/modelCatalog.ts)
- [src/store.ts](/Users/zhixian/Desktop/gemini-canvas2/src/store.ts)

### Add a new provider with a new protocol

Change:

- [src/assets/provider-logos](/Users/zhixian/Desktop/gemini-canvas2/src/assets/provider-logos)
- [src/components/ProviderMark.tsx](/Users/zhixian/Desktop/gemini-canvas2/src/components/ProviderMark.tsx)
- [src/lib/modelCatalog.ts](/Users/zhixian/Desktop/gemini-canvas2/src/lib/modelCatalog.ts)
- [src/store.ts](/Users/zhixian/Desktop/gemini-canvas2/src/store.ts)
- [src/lib/ai.ts](/Users/zhixian/Desktop/gemini-canvas2/src/lib/ai.ts)
