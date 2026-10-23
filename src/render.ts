import mermaid from 'mermaid';

export type RenderResult = { ok: true; svg: string } | { ok: false; message: string };

let counter = 0;

export function initMermaid(): void {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    htmlLabels: false,
    flowchart: { htmlLabels: false },
  });
}

export async function renderDiagram(code: string): Promise<RenderResult> {
  const id = `mermaid-render-${++counter}`;
  try {
    // parse は不正な構文なら例外を投げる。render 前に弾くことで body にエラー SVG が残らない。
    await mermaid.parse(code);
    const { svg } = await mermaid.render(id, code);
    return { ok: true, svg };
  } catch (e) {
    // 念のため render が body に残した一時要素を片付ける
    document.getElementById(id)?.remove();
    document.getElementById(`d${id}`)?.remove();
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, message };
  }
}
