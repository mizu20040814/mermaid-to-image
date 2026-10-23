import './style.css';
import sample from '../examples/sample.mmd?raw';
import { initMermaid, renderDiagram } from './render';

const editor = document.querySelector<HTMLTextAreaElement>('#editor')!;
const preview = document.querySelector<HTMLDivElement>('#preview')!;
const errorBox = document.querySelector<HTMLDivElement>('#error')!;
const pngButton = document.querySelector<HTMLButtonElement>('#download-png')!;
const svgButton = document.querySelector<HTMLButtonElement>('#download-svg')!;

// 最後に成功した SVG。エラー中・空入力中は null（Task 3 が書き出しに使う）
export let currentSvg: string | null = null;

let seq = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

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
    return;
  }
  const result = await renderDiagram(code);
  if (my !== seq) return;
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

initMermaid();
setButtons(false);
editor.value = sample;
editor.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(() => void update(), 300);
});
void update();
