import './style.css';
import sample from '../examples/sample.mmd?raw';
import { initMermaid, renderDiagram } from './render';
import { downloadBlob, prepareSvgForExport, svgToPngBlob } from './export';

const editor = document.querySelector<HTMLTextAreaElement>('#editor')!;
const preview = document.querySelector<HTMLDivElement>('#preview')!;
const errorBox = document.querySelector<HTMLDivElement>('#error')!;
const pngButton = document.querySelector<HTMLButtonElement>('#download-png')!;
const svgButton = document.querySelector<HTMLButtonElement>('#download-svg')!;

// 最後に成功した SVG。エラー中・空入力中は null（書き出しに使う）
export let currentSvg: string | null = null;

let seq = 0;
// 入力があってから最新の描画が終わるまで true（その間の書き出しは最新の図を待つ）
let pending = false;
let timer: ReturnType<typeof setTimeout> | undefined;
// ダウンロードのために始めた描画（同時のクリックで共有する）
let refreshing: Promise<void> | null = null;

function setButtons(enabled: boolean): void {
  pngButton.disabled = !enabled;
  svgButton.disabled = !enabled;
}

async function update(): Promise<void> {
  const my = ++seq;
  const code = editor.value;
  if (code.trim() === '') {
    preview.innerHTML = '';
    errorBox.textContent = '';
    currentSvg = null;
    setButtons(false);
    if (my === seq) pending = false;
    return;
  }
  const result = await renderDiagram(code);
  if (my !== seq) return;
  pending = false;
  if (result.ok) {
    preview.innerHTML = result.svg;
    errorBox.textContent = '';
    currentSvg = result.svg;
    setButtons(true);
  } else {
    errorBox.textContent = `構文エラー: ${result.message}`;
    currentSvg = null;
    setButtons(false);
  }
}

// 未反映の入力があれば今すぐ描画を済ませ、最新のコードに対応する SVG だけを返す
async function freshSvg(): Promise<string | null> {
  while (pending) {
    clearTimeout(timer);
    // 同時に押されたボタン同士で別々に描画を始めると互いに無効化し合うので、進行中の描画を共有する
    refreshing ??= update().finally(() => {
      refreshing = null;
    });
    await refreshing;
  }
  return currentSvg;
}

svgButton.addEventListener('click', async () => {
  try {
    const svgSource = await freshSvg();
    if (svgSource === null) return;
    const { svg } = prepareSvgForExport(svgSource);
    downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), 'diagram.svg');
  } catch (e) {
    console.error(e);
    errorBox.textContent = 'SVG の書き出しに失敗しました';
  }
});

pngButton.addEventListener('click', async () => {
  try {
    const svgSource = await freshSvg();
    if (svgSource === null) return;
    downloadBlob(await svgToPngBlob(svgSource), 'diagram.png');
  } catch (e) {
    console.error(e);
    errorBox.textContent = 'PNG の書き出しに失敗しました';
  }
});

initMermaid();
setButtons(false);
editor.value = sample;
editor.addEventListener('input', () => {
  // 描画中の古い入力の結果を無効にし、それが pending を解除しないようにする
  seq++;
  pending = true;
  clearTimeout(timer);
  timer = setTimeout(() => void update(), 300);
});
void update();
