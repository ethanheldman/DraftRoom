import type { ScriptNode, ElementType } from '../types/screenplay';

// ── Indented plain-text screenplay parser ─────────────────────────────────────
// Handles .txt files exported with space-based indentation (22sp char, 10sp dialogue, etc.)

function parseIndentedScreenplay(lines: string[]): ScriptNode[] {
  const nodes: ScriptNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed) { i++; continue; }

    const indent = raw.length - raw.trimStart().length;

    // Scene heading: minimal indent, starts with INT./EXT.
    if (/^(INT\.|EXT\.|INT\.\/EXT\.)/i.test(trimmed)) {
      nodes.push({ type: 'scene_heading', content: trimmed.toUpperCase() });
      i++; continue;
    }

    // Transition: heavy right-side indent (40+)
    if (indent >= 36 && /[A-Z]/.test(trimmed)) {
      nodes.push({ type: 'transition', content: trimmed });
      i++; continue;
    }

    // Character name: indent 18–32, all caps
    if (indent >= 18 && indent <= 32 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
      nodes.push({ type: 'character', content: trimmed });
      i++;
      while (i < lines.length && lines[i].trim() !== '') {
        const dRaw = lines[i];
        const dTrimmed = dRaw.trim();
        const dIndent = dRaw.length - dRaw.trimStart().length;
        if (dTrimmed.startsWith('(') && dTrimmed.endsWith(')')) {
          nodes.push({ type: 'parenthetical', content: dTrimmed });
        } else if (dIndent >= 8) {
          nodes.push({ type: 'dialogue', content: dTrimmed });
        } else {
          break;
        }
        i++;
      }
      continue;
    }

    nodes.push({ type: 'action', content: trimmed });
    i++;
  }

  return nodes.length > 0 ? nodes : [
    { type: 'scene_heading', content: 'INT. LOCATION - DAY' },
    { type: 'action', content: '' },
  ];
}

// ── Fountain / plain-text parser ──────────────────────────────────────────────

export function parseFountain(text: string): ScriptNode[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  // If the file uses heavy space indentation (exported .txt screenplay style),
  // delegate to the indentation-aware parser.
  const indentedLines = lines.filter(l => /^ {18,}\S/.test(l) && l.trim().length > 0);
  if (indentedLines.length > 3) {
    return parseIndentedScreenplay(lines);
  }

  const nodes: ScriptNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    // Skip blank lines
    if (!trimmed) { i++; continue; }

    // Scene heading: starts with INT. / EXT. / INT./EXT. / I/E or forced with .
    if (
      /^(INT\.|EXT\.|INT\.\/EXT\.|I\/E[\s.])/i.test(trimmed) ||
      (trimmed.startsWith('.') && !trimmed.startsWith('..'))
    ) {
      const content = trimmed.startsWith('.') ? trimmed.slice(1) : trimmed;
      nodes.push({ type: 'scene_heading', content: content.toUpperCase() });
      i++; continue;
    }

    // Transition: forced with > or ALL CAPS ending in TO:
    if (trimmed.startsWith('>') && !trimmed.startsWith('>>')) {
      nodes.push({ type: 'transition', content: trimmed.slice(1).trim() });
      i++; continue;
    }
    if (/^[A-Z ]+TO:$/.test(trimmed) || /^FADE\s+(IN|OUT)[.:]?$/i.test(trimmed)) {
      nodes.push({ type: 'transition', content: trimmed });
      i++; continue;
    }

    // Centered text: >>text<<
    if (trimmed.startsWith('>>') && trimmed.endsWith('<<')) {
      nodes.push({ type: 'act', content: trimmed.slice(2, -2).trim() });
      i++; continue;
    }

    // ── Character cue detection ──────────────────────────────────────────────
    // Fountain spec: ALL CAPS line, one blank line before it, NO blank line after it.
    // We add heuristics to avoid mis-classifying all-caps action lines.

    const isForced = trimmed.startsWith('@');
    const candidate = isForced ? trimmed.slice(1).trim() : trimmed;
    // Strip extensions like (V.O.) (O.S.) (CONT'D) for analysis
    const cleanName = candidate.replace(/\s*\([^)]*\)\s*/g, '').trim();
    const isAllCaps = cleanName.length > 0 &&
      cleanName === cleanName.toUpperCase() &&
      /[A-Z]/.test(cleanName);

    if (isForced || isAllCaps) {
      // Blank line immediately before (Fountain rule) or right after a scene/transition
      const prevBlank = i === 0 || lines[i - 1].trim() === '';
      const lastType = nodes.length > 0 ? nodes[nodes.length - 1].type : null;
      const afterAnchor = lastType === 'scene_heading' || lastType === 'transition';

      // Dialogue must follow IMMEDIATELY — the very next line must be non-empty.
      // The old code used find() which matched any line in the rest of the file — that's the main bug.
      const nextImmediate = i + 1 < lines.length ? lines[i + 1].trim() : '';
      const nextIsDialogue = nextImmediate !== '';

      // Heuristics that flag the line as action rather than a character name:
      const endsWithPunct   = /[.!?…]$/.test(cleanName);                  // "CLOSE ON." → action
      const startsWithArticle = /^(THE|A|AN)\s/i.test(cleanName);         // "A STRANGER" → action
      const hasEmDash        = /--|—/.test(cleanName);                     // em-dash → action
      const tooManyWords     = cleanName.split(/\s+/).length > 6;          // long description → action
      const tooLong          = cleanName.length > 50;                      // very long → action

      const looksLikeCharacter =
        (prevBlank || afterAnchor) &&
        nextIsDialogue &&
        !endsWithPunct &&
        !startsWithArticle &&
        !hasEmDash &&
        !tooManyWords &&
        !tooLong;

      if (isForced || looksLikeCharacter) {
        // Preserve the (V.O.) / (O.S.) / (CONT'D) extension on the node so we
        // can round-trip it through export without losing format.
        const extMatch = candidate.match(/\(([^)]+)\)\s*$/);
        nodes.push({
          type: 'character',
          content: candidate,
          extension: extMatch ? extMatch[1].trim() : undefined,
        });
        i++;
        // Read dialogue block — runs until the next blank line
        while (i < lines.length && lines[i].trim() !== '') {
          const dLine = lines[i].trim();
          if (dLine.startsWith('(') && dLine.endsWith(')')) {
            nodes.push({ type: 'parenthetical', content: dLine });
          } else {
            nodes.push({ type: 'dialogue', content: dLine });
          }
          i++;
        }
        continue;
      }
    }

    // Default: action
    nodes.push({ type: 'action', content: trimmed });
    i++;
  }

  return nodes.length > 0 ? nodes : [
    { type: 'scene_heading', content: 'INT. LOCATION - DAY' },
    { type: 'action', content: '' },
  ];
}

// ─── (CONT'D) / (MORE) helpers ───────────────────────────────────────────────
//
// A writer typing two dialogue blocks in a row for the same character on the
// same page is the natural "pause / beat" pattern. On export, re-introduce the
// `(CONT'D)` extension on the second (and later) character cue, and between
// page breaks mid-dialogue insert `(MORE)` + `(CONT'D)`. This matches what
// Final Draft / Highland produce and is a hard requirement for anyone shipping
// a PDF to a producer.
//
// We DON'T modify the source nodes — we produce a shallow rewrite just for the
// exporter. Callers pass the result into their normal switch.

const LINES_PER_PAGE = 55;   // Rough industry average for a 1-1/8" line height
                             // at 12pt Courier on US Letter with 1"/1.5"/1"/1" margins.

function normalizeCharacterCue(raw: string): { name: string; extension?: string } {
  // "DETECTIVE MAYA (V.O.)" → { name: "DETECTIVE MAYA", extension: "V.O." }
  const m = raw.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (m) return { name: m[1].trim(), extension: m[2].trim() };
  return { name: raw.trim() };
}

function formatCharacterCue(name: string, extension?: string): string {
  const n = name.toUpperCase();
  return extension ? `${n} (${extension.toUpperCase()})` : n;
}

/**
 * Returns a shallow copy of `nodes` with (CONT'D) and (MORE) inserted where a
 * professional exporter would. Never mutates the input.
 */
export function withContinueds(nodes: ScriptNode[]): ScriptNode[] {
  const out: ScriptNode[] = [];
  let lastCharacterName: string | null = null;
  let linesThisPage = 0;
  let dialogueBlockCharacter: string | null = null;

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];

    // Simple line estimator — scene heading / transition / act reset the page counter.
    if (n.type === 'scene_heading' || n.type === 'act') {
      linesThisPage += 3;
    } else {
      linesThisPage += 1 + Math.floor((n.content?.length ?? 0) / 60);
    }

    if (n.type === 'character') {
      const { name, extension } = normalizeCharacterCue(n.content);
      const continued = lastCharacterName === name;
      // If the previous cue was this same character (no scene break in-between)
      // reattach (CONT'D). Preserve any explicit V.O./O.S. the writer typed.
      const finalExt =
        extension ??
        (continued ? "CONT'D" : undefined);

      out.push({
        ...n,
        content: formatCharacterCue(name, finalExt),
        extension: finalExt,
      });
      dialogueBlockCharacter = name;
      lastCharacterName = name;
      continue;
    }

    // Between dialogue on different pages — inject (MORE) / (CONT'D).
    if (n.type === 'dialogue' && dialogueBlockCharacter && linesThisPage >= LINES_PER_PAGE) {
      out.push({ type: 'parenthetical', content: '(MORE)' });
      out.push({
        type: 'character',
        content: formatCharacterCue(dialogueBlockCharacter, "CONT'D"),
        extension: "CONT'D",
      });
      linesThisPage = 0;
    }

    // Action / transition / scene heading breaks the "same character" chain.
    if (n.type === 'scene_heading' || n.type === 'action' || n.type === 'transition') {
      dialogueBlockCharacter = null;
      lastCharacterName = null;
    }

    out.push(n);
  }
  return out;
}

export function exportFountain(nodes: ScriptNode[], title: string): string {
  const lines: string[] = [];

  // Title page
  lines.push(`Title: ${title}`);
  lines.push('Credit: Written by');
  lines.push('Author: ');
  lines.push('');
  lines.push('');

  // Inject (CONT'D) / (MORE) so the exported file matches industry format.
  const processed = withContinueds(nodes);
  for (const node of processed) {
    switch (node.type) {
      case 'scene_heading':
        lines.push('');
        lines.push(node.content.toUpperCase());
        lines.push('');
        break;
      case 'action':
        lines.push(node.content);
        lines.push('');
        break;
      case 'character':
        lines.push('');
        lines.push(node.content.toUpperCase());
        break;
      case 'dialogue':
        lines.push(node.content);
        break;
      case 'parenthetical':
        lines.push(node.content);
        break;
      case 'transition':
        lines.push('');
        lines.push(`> ${node.content}`);
        lines.push('');
        break;
      case 'shot':
        lines.push(node.content.toUpperCase());
        lines.push('');
        break;
      case 'act':
        lines.push(`>> ${node.content} <<`);
        lines.push('');
        break;
      case 'text':
        lines.push(node.content);
        lines.push('');
        break;
    }
  }

  return lines.join('\n');
}

// ─── FDX (Final Draft XML) import ────────────────────────────────────────────

export function parseFDX(xmlText: string): ScriptNode[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const paragraphs = doc.querySelectorAll('Paragraph');
  const nodes: ScriptNode[] = [];

  const FDX_TYPE_MAP: Record<string, ElementType> = {
    'Scene Heading': 'scene_heading',
    'Action': 'action',
    'Character': 'character',
    'Dialogue': 'dialogue',
    'Parenthetical': 'parenthetical',
    'Transition': 'transition',
    'Shot': 'shot',
    'General': 'text',
  };

  paragraphs.forEach((p) => {
    const type = p.getAttribute('Type') ?? 'General';
    const mapped: ElementType = FDX_TYPE_MAP[type] ?? 'text';
    // Collect text from all Text child elements
    const textNodes = p.querySelectorAll('Text');
    let content = '';
    textNodes.forEach(t => { content += t.textContent ?? ''; });
    content = content.trim();
    if (content || mapped === 'action') {
      nodes.push({ type: mapped, content });
    }
  });

  return nodes.length > 0 ? nodes : [
    { type: 'scene_heading', content: 'INT. LOCATION - DAY' },
    { type: 'action', content: '' },
  ];
}

// ─── PDF import ──────────────────────────────────────────────────────────────

export async function parsePDF(arrayBuffer: ArrayBuffer): Promise<ScriptNode[]> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  // ── Collect raw text items per page ──────────────────────────────────────
  type TItem = { str: string; x: number; y: number };
  type PageData = { items: TItem[]; pw: number; ph: number };
  const pages: PageData[] = [];

  for (let pn = 1; pn <= pdf.numPages; pn++) {
    const page = await pdf.getPage(pn);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const items: TItem[] = [];
    for (const it of tc.items) {
      if ('str' in it && it.str.trim()) {
        items.push({ str: it.str, x: it.transform[4], y: it.transform[5] });
      }
    }
    pages.push({ items, pw: vp.width, ph: vp.height });
  }

  // ── Pass 1: detect repeated footer/header text to strip ──────────────────
  // Text in bottom/top 8% of page that appears on ≥ (numPages/3) pages
  const edgeFreq = new Map<string, number>();
  for (const { items, ph } of pages) {
    const seen = new Set<string>();
    for (const it of items) {
      if (it.y / ph < 0.08 || it.y / ph > 0.92) {
        const key = it.str.trim().toLowerCase();
        if (!seen.has(key)) { edgeFreq.set(key, (edgeFreq.get(key) ?? 0) + 1); seen.add(key); }
      }
    }
  }
  const stripSet = new Set<string>(['created using celtx', 'created with celtx']);
  const minRepeat = Math.max(2, Math.ceil(pages.length / 3));
  for (const [txt, cnt] of edgeFreq) { if (cnt >= minRepeat) stripSet.add(txt); }

  // ── Helper: split items in a Y-row into 1 or 2 columns ───────────────────
  // Finds the largest gap between end-of-item and start-of-next-item.
  // Splits there if the gap exceeds 18% of page width (dual-column dialogue).
  function splitColumns(items: TItem[], pw: number): TItem[][] {
    if (items.length < 2) return [items];
    const sorted = [...items].sort((a, b) => a.x - b.x);
    let maxGap = 0, splitAt = 0;
    for (let i = 1; i < sorted.length; i++) {
      // Approximate end of previous item: 6.5pt per character (Courier)
      const prevEnd = sorted[i - 1].x + sorted[i - 1].str.length * 6.5;
      const gap = sorted[i].x - prevEnd;
      if (gap > maxGap) { maxGap = gap; splitAt = i; }
    }
    if (maxGap > pw * 0.18 && splitAt > 0) {
      const left = sorted.slice(0, splitAt);
      const right = sorted.slice(splitAt);
      const lTxt = left.map(i => i.str).join('').trim();
      const rTxt = right.map(i => i.str).join('').trim();
      if (lTxt.length >= 2 && rTxt.length >= 2) return [left, right];
    }
    return [sorted];
  }

  // ── Pass 2: build structured lines (with dual-column awareness) ───────────
  type Line = { text: string; x: number; relX: number; relY: number };
  const allLines: (Line | null)[] = []; // null = page break

  for (const { items, pw, ph } of pages) {
    // Group items by Y with ±2pt tolerance
    const rows = new Map<number, TItem[]>();
    for (const it of items) {
      let placed = false;
      for (const ky of rows.keys()) {
        if (Math.abs(ky - it.y) <= 2) { rows.get(ky)!.push(it); placed = true; break; }
      }
      if (!placed) rows.set(it.y, [it]);
    }

    const sortedYs = Array.from(rows.keys()).sort((a, b) => b - a); // top-to-bottom
    for (const y of sortedYs) {
      const rowItems = rows.get(y)!;
      const relY = y / ph;
      const isEdge = relY < 0.08 || relY > 0.92;
      const fullText = rowItems.sort((a, b) => a.x - b.x).map(i => i.str).join('').trim();

      if (!fullText) continue;

      // Strip known footer/header text (substring match to handle multi-item rows)
      if (stripSet.has(fullText.toLowerCase())) continue;
      let skip = false;
      for (const s of stripSet) { if (fullText.toLowerCase().includes(s)) { skip = true; break; } }
      if (skip) continue;

      // Strip page numbers: lone 1-3 digit numbers (with optional period) in edge zones
      if (isEdge && /^\d{1,3}\.?$/.test(fullText)) continue;

      // Detect dual columns and emit as separate lines
      const cols = splitColumns(rowItems, pw);
      for (const col of cols) {
        const colText = col.map(i => i.str).join('').trim();
        if (!colText) continue;
        const x = col[0].x;
        allLines.push({ text: colText, x, relX: x / pw, relY });
      }
    }
    allLines.push(null); // page break — resets prevType
  }

  // ── Pass 3: classify lines into screenplay elements ───────────────────────
  // Standard screenplay X offsets on 8.5" (612pt) page:
  //   Action / scene heading : ~1.5" = 0.176 relX
  //   Dialogue left edge     : ~2.0" = 0.235 relX  (well above 0.20 threshold)
  //   Parenthetical          : ~2.4" = 0.284 relX
  //   Character name         : ~3.5" = 0.392 relX
  // Using 0.20 as the boundary separating action (< 0.20) from dialogue (≥ 0.20).
  const nodes: ScriptNode[] = [];
  let prevType: ElementType | null = null;
  let foundFirstScene = false;

  for (const line of allLines) {
    if (!line) { prevType = null; continue; }
    const { text, relX } = line;
    const trimmed = text.trim();
    const upper = trimmed.toUpperCase();
    const isAllCaps = trimmed === upper && /[A-Z]/.test(upper);

    // Scene heading (triggers end of title-page skip)
    if (/^(INT\.|EXT\.|INT\.\/EXT\.|I\/E[\s.])/.test(upper)) {
      foundFirstScene = true;
      nodes.push({ type: 'scene_heading', content: upper });
      prevType = 'scene_heading';
      continue;
    }

    // Skip title page content (everything before first INT./EXT.)
    if (!foundFirstScene) continue;

    // Transition
    if (isAllCaps && (
      /^FADE (IN|OUT)[.:]?$/.test(upper) ||
      /\s?TO:$/.test(upper) ||
      /^(DISSOLVE|SMASH CUT|MATCH CUT)/.test(upper)
    )) {
      nodes.push({ type: 'transition', content: trimmed });
      prevType = 'transition';
      continue;
    }

    // Parenthetical — detect by content pattern (works for both columns)
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      nodes.push({ type: 'parenthetical', content: trimmed });
      prevType = 'parenthetical';
      continue;
    }

    // Character: all-caps, clearly indented (> 30% from left), short, not a heading
    if (isAllCaps && relX > 0.30 && trimmed.length < 60 && !/^(INT\.|EXT\.)/.test(upper)) {
      nodes.push({ type: 'character', content: trimmed });
      prevType = 'character';
      continue;
    }

    // Dialogue: follows character/parenthetical/dialogue AND indented beyond action margin.
    // The 0.20 threshold keeps action lines (relX ≈ 0.176) from being mis-classified
    // as dialogue even when they immediately follow a dialogue block.
    if (
      (prevType === 'character' || prevType === 'parenthetical' || prevType === 'dialogue') &&
      relX >= 0.20
    ) {
      nodes.push({ type: 'dialogue', content: trimmed });
      prevType = 'dialogue';
      continue;
    }

    // Default: action
    nodes.push({ type: 'action', content: trimmed });
    prevType = 'action';
  }

  return nodes.length > 0 ? nodes : [
    { type: 'scene_heading', content: 'INT. LOCATION - DAY' },
    { type: 'action', content: '' },
  ];
}

// ─── FDX (Final Draft XML) export ────────────────────────────────────────────

export function exportFDX(nodes: ScriptNode[], title: string, author = ''): string {
  const TYPE_MAP: Record<string, string> = {
    scene_heading: 'Scene Heading',
    action: 'Action',
    character: 'Character',
    dialogue: 'Dialogue',
    parenthetical: 'Parenthetical',
    transition: 'Transition',
    shot: 'Shot',
    act: 'General',
    text: 'General',
  };

  function esc(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  const paras = withContinueds(nodes)
    .filter(n => n.content || n.type === 'action')
    .map(n => {
      const t = TYPE_MAP[n.type] ?? 'General';
      const bold = n.marks?.includes('bold') ? ' Bold="Yes"' : '';
      const italic = n.marks?.includes('italic') ? ' Italic="Yes"' : '';
      const underline = n.marks?.includes('underline') ? ' Underline="Yes"' : '';
      return `    <Paragraph Type="${t}">\n      <Text${bold}${italic}${underline}>${esc(n.content || '')}</Text>\n    </Paragraph>`;
    })
    .join('\n');

  const titlePara = `      <Paragraph>\n        <Text>${esc(title)}</Text>\n      </Paragraph>`;
  const authorPara = author ? `\n      <Paragraph>\n        <Text>${esc(author)}</Text>\n      </Paragraph>` : '';

  return `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<FinalDraft DocumentType="Script" Template="No" Version="2">
  <Content>
${paras}
  </Content>
  <TitlePage>
    <Content>
${titlePara}${authorPara}
    </Content>
  </TitlePage>
</FinalDraft>`;
}

export function exportTxt(nodes: ScriptNode[]): string {
  const lines: string[] = [];

  for (const node of withContinueds(nodes)) {
    const content = node.content || '';
    switch (node.type) {
      case 'scene_heading':
        lines.push('');
        lines.push(content.toUpperCase());
        lines.push('');
        break;
      case 'action':
        lines.push(content);
        lines.push('');
        break;
      case 'character':
        lines.push('');
        lines.push(' '.repeat(22) + content.toUpperCase());
        break;
      case 'dialogue':
        lines.push(' '.repeat(10) + content);
        break;
      case 'parenthetical':
        lines.push(' '.repeat(15) + content);
        break;
      case 'transition':
        lines.push(' '.repeat(40) + content.toUpperCase());
        lines.push('');
        break;
      case 'shot':
        lines.push(content.toUpperCase());
        lines.push('');
        break;
      case 'act':
        lines.push('');
        lines.push(' '.repeat(30) + content.toUpperCase());
        lines.push('');
        break;
      case 'text':
        lines.push(content);
        lines.push('');
        break;
    }
  }

  return lines.join('\n');
}
