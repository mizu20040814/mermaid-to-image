const SVG_NS = 'http://www.w3.org/2000/svg';

export function prepareSvgForExport(svg: string): { svg: string; width: number; height: number } {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = doc.documentElement;
  if (root.localName !== 'svg' || doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('SVG を読み取れません');
  }
  const parts = (root.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
  const width = parts[2];
  const height = parts[3];
  if (parts.length !== 4 || !(width > 0) || !(height > 0)) {
    throw new Error('SVG に有効な viewBox がありません');
  }
  root.setAttribute('width', String(width));
  root.setAttribute('height', String(height));
  const style = (root.getAttribute('style') ?? '')
    .split(';')
    .filter((d) => d.trim() !== '' && d.split(':')[0].trim().toLowerCase() !== 'max-width')
    .join(';');
  if (style === '') root.removeAttribute('style');
  else root.setAttribute('style', style);
  if (root.getAttribute('xmlns') !== SVG_NS) root.setAttribute('xmlns', SVG_NS);
  return { svg: new XMLSerializer().serializeToString(root), width, height };
}

export function pngScale(width: number, height: number, desired = 2, maxSide = 8192): number {
  return Math.min(desired, maxSide / Math.max(width, height));
}

export async function svgToPngBlob(svg: string): Promise<Blob> {
  const { svg: prepared, width, height } = prepareSvgForExport(svg);
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(prepared);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('SVG の読み込みに失敗しました'));
    img.src = url;
  });
  const scale = pngScale(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas を使えません');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG の生成に失敗しました'))), 'image/png');
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
