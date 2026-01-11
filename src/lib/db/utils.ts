export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hexArray = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
    return [
      hexArray.slice(0, 4).join(''),
      hexArray.slice(4, 6).join(''),
      hexArray.slice(6, 8).join(''),
      hexArray.slice(8, 10).join(''),
      hexArray.slice(10).join(''),
    ].join('-');
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function generateRandomString(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function timestamp(): string {
  return new Date().toISOString();
}

export function dateString(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

export const generateId = {
  group: (): string => `group:${generateUUID()}`,
  tracker: (): string => `tracker:${generateUUID()}`,
  entry: (): string => `entry:${timestamp()}:${generateRandomString()}`,
  session: (): string => `session:${timestamp()}:${generateRandomString()}`,
  goal: (): string => `goal:${generateUUID()}`,
};

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildPath(parentPath: string | null, slug: string): string {
  if (!parentPath) return slug;
  return `${parentPath}/${slug}`;
}

export function calculateDepth(path: string): number {
  return path.split('/').length - 1;
}

export function getParentPath(path: string): string | null {
  const parts = path.split('/');
  if (parts.length === 1) return null;
  return parts.slice(0, -1).join('/');
}
