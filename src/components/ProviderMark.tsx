import React from 'react';
import { type ProviderCatalogId } from '../lib/modelCatalog';
import geminiLogo from '../assets/provider-logos/gemini.svg';
import deepseekLogo from '../assets/provider-logos/deepseek.ico';
import qwenLogo from '../assets/provider-logos/qwen.ico';
import moonshotLogo from '../assets/provider-logos/moonshot.ico';
import zhipuLogo from '../assets/provider-logos/zhipu.svg';

const PROVIDER_LOGOS: Record<
  ProviderCatalogId,
  {
    src: string;
    alt: string;
  }
> = {
  gemini: {
    src: geminiLogo,
    alt: 'Gemini',
  },
  deepseek: {
    src: deepseekLogo,
    alt: 'DeepSeek',
  },
  qwen: {
    src: qwenLogo,
    alt: 'Qwen',
  },
  moonshot: {
    src: moonshotLogo,
    alt: 'Moonshot',
  },
  zhipu: {
    src: zhipuLogo,
    alt: 'Zhipu',
  },
};

interface ProviderMarkProps {
  providerId: ProviderCatalogId;
  size?: 'sm' | 'md';
  muted?: boolean;
}

const SIZE_CLASS = {
  sm: 'h-8 w-8 text-[10px] rounded-xl',
  md: 'h-10 w-10 text-[11px] rounded-[0.95rem]',
};

export default function ProviderMark({
  providerId,
  size = 'md',
  muted = false,
}: ProviderMarkProps) {
  const logo = PROVIDER_LOGOS[providerId];

  return (
    <div
      className={`flex shrink-0 items-center justify-center border font-semibold tracking-[0.14em] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ${
        SIZE_CLASS[size]
      } ${muted ? 'border-slate-200 bg-slate-100' : 'border-slate-200/80 bg-white/92'}`}
    >
      <img
        src={logo.src}
        alt={logo.alt}
        className={`max-h-[68%] max-w-[68%] object-contain ${muted ? 'opacity-45 grayscale' : ''}`}
      />
    </div>
  );
}
