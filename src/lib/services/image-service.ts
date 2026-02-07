type ImageProvider = 'openrouter' | 'openai';

export type ImageGenerateOptions = {
  provider: ImageProvider;
  apiKey: string;
  model: string;
  prompt: string;
  size?: '512x512' | '1024x1024' | '1024x1536' | '1536x1024';
};

const OPENAI_IMAGE_ENDPOINT = 'https://api.openai.com/v1/images/generations';
const OPENROUTER_CHAT_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_IMAGE_BYTES = 500 * 1024;

export const supportsImageModel = (model: string) =>
  model.toLowerCase().includes('image') || model.toLowerCase().includes('dall-e');

export const supportsVisionModel = (model: string) => {
  const lower = model.toLowerCase();
  return lower.includes('gpt') || lower.includes('claude') || lower.includes('gemini');
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read image blob.'));
    reader.readAsDataURL(blob);
  });

const estimateDataUrlBytes = (dataUrl: string) => {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.floor((base64.length * 3) / 4);
};

const loadImage = (dataUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image.'));
    img.src = dataUrl;
  });

export const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const response = await fetch(dataUrl);
  return response.blob();
};

export const compressDataUrl = async (dataUrl: string, maxBytes: number = MAX_IMAGE_BYTES) => {
  if (estimateDataUrlBytes(dataUrl) <= maxBytes) return dataUrl;

  const img = await loadImage(dataUrl);
  let width = img.width;
  let height = img.height;

  const maxDimension = 1280;
  if (Math.max(width, height) > maxDimension) {
    const scale = maxDimension / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to compress image.');
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.9;
  let compressed = canvas.toDataURL('image/jpeg', quality);

  while (estimateDataUrlBytes(compressed) > maxBytes && quality > 0.5) {
    quality -= 0.1;
    compressed = canvas.toDataURL('image/jpeg', quality);
  }

  if (estimateDataUrlBytes(compressed) > maxBytes) {
    const scale = 0.85;
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    compressed = canvas.toDataURL('image/jpeg', 0.8);
  }

  return compressed;
};

export const createThumbnailDataUrl = async (
  dataUrl: string,
  maxBytes: number = 10 * 1024,
  maxDimension: number = 256,
) => {
  const img = await loadImage(dataUrl);
  let width = img.width;
  let height = img.height;

  if (Math.max(width, height) > maxDimension) {
    const scale = maxDimension / Math.max(width, height);
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to create thumbnail.');
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.7;
  let thumbnail = canvas.toDataURL('image/jpeg', quality);

  while (estimateDataUrlBytes(thumbnail) > maxBytes && quality > 0.3) {
    quality -= 0.1;
    thumbnail = canvas.toDataURL('image/jpeg', quality);
  }

  if (estimateDataUrlBytes(thumbnail) > maxBytes) {
    const scale = 0.8;
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    thumbnail = canvas.toDataURL('image/jpeg', 0.5);
  }

  return thumbnail;
};

const fetchImageAsDataUrl = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image (${response.status}).`);
  }
  const blob = await response.blob();
  return blobToDataUrl(blob);
};

export const readFileAsDataUrl = async (file: File) => {
  const dataUrl = await blobToDataUrl(file);
  return compressDataUrl(dataUrl);
};

export const generateImage = async (options: ImageGenerateOptions) => {
  const endpoint =
    options.provider === 'openrouter' ? OPENROUTER_CHAT_ENDPOINT : OPENAI_IMAGE_ENDPOINT;
  const headers = {
    Authorization: `Bearer ${options.apiKey}`,
    'Content-Type': 'application/json',
    ...(options.provider === 'openrouter'
      ? {
          'HTTP-Referer':
            typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
          'X-Title': 'Lifetrack',
        }
      : {}),
  };
  const body =
    options.provider === 'openrouter'
      ? {
          model: options.model,
          messages: [{ role: 'user', content: options.prompt }],
          modalities: ['image', 'text'],
        }
      : {
          model: options.model,
          prompt: options.prompt,
          size: options.size ?? '1024x1024',
          response_format: 'b64_json',
        };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let message = `Image generation failed (${response.status}).`;
    try {
      const data = await response.json();
      if (data?.error?.message) {
        message = data.error.message;
      }
    } catch {
      // ignore parsing errors
    }
    throw new Error(message);
  }

  const data = await response.json();
  if (options.provider === 'openrouter') {
    const message = data?.choices?.[0]?.message;
    const imageUrl = message?.images?.[0]?.image_url?.url;
    if (!imageUrl) {
      throw new Error('Image response was empty.');
    }
    const dataUrl = imageUrl.startsWith('data:') ? imageUrl : await fetchImageAsDataUrl(imageUrl);
    return { dataUrl: await compressDataUrl(dataUrl) };
  }

  const image = data?.data?.[0];
  if (image?.b64_json) {
    const dataUrl = `data:image/png;base64,${image.b64_json}`;
    return { dataUrl: await compressDataUrl(dataUrl) };
  }
  if (image?.url) {
    const dataUrl = await fetchImageAsDataUrl(image.url);
    return { dataUrl: await compressDataUrl(dataUrl) };
  }

  throw new Error('Image response was empty.');
};
