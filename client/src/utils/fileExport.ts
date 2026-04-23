import type { Project, MediaItem } from '../types/screenplay';
import type { ScriptNode } from '../types/screenplay';
import { makeId } from './ids';

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Exec Overview HTML doc ────────────────────────────────────────────────────

export function generateExecOverviewHTML(project: Project, _nodes: ScriptNode[]): string {
  const beats = project.beatSheet ?? [];
  const cast = project.castAndCrew ?? [];
  const budget = project.budget ?? [];
  const totalEstimated = budget.reduce((s, l) => s + (l.estimated || 0), 0);
  const totalActual = budget.reduce((s, l) => s + (l.actual || 0), 0);
  const actColors = ['#7c3aed', '#f59e0b', '#3b82f6'];
  const actLabels = ['Setup', 'Confrontation', 'Resolution'];

  const beatsByAct = [1, 2, 3].map(act =>
    beats.filter(b => b.act === act).sort((a, b) => a.page - b.page)
  );

  const castByCategory = {
    cast: cast.filter(m => m.category === 'cast'),
    crew: cast.filter(m => m.category === 'crew'),
    vendor: cast.filter(m => m.category === 'vendor'),
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(project.title)} — Production Overview</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1a1a2e; background: #fff; }
  .page { width: 8.5in; min-height: 11in; padding: 1in; position: relative; }
  @media print { .page { page-break-after: always; } .page:last-child { page-break-after: auto; } }

  /* Cover */
  .cover { background: linear-gradient(135deg, #0a0a1a 0%, #1a0f3e 50%, #0f1528 100%); color: #fff; display: flex; flex-direction: column; justify-content: center; gap: 32px; }
  .cover-eyebrow { font-size: 9pt; font-weight: 600; text-transform: uppercase; letter-spacing: 5px; color: rgba(255,255,255,0.4); }
  .cover-title { font-size: 54pt; font-weight: 900; letter-spacing: -2px; line-height: 1; color: #fff; }
  .cover-accent { width: 48px; height: 4px; background: #7c3aed; border-radius: 2px; }
  .cover-logline { font-size: 13pt; color: rgba(255,255,255,0.7); line-height: 1.7; max-width: 5in; font-style: italic; }
  .cover-footer { position: absolute; bottom: 1in; left: 1in; right: 1in; display: flex; justify-content: space-between; color: rgba(255,255,255,0.3); font-size: 8pt; letter-spacing: 2px; text-transform: uppercase; }

  /* Interior */
  .section-eye { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 5px; color: #7c3aed; margin-bottom: 8px; }
  .page-title { font-size: 32pt; font-weight: 900; color: #1a1a2e; margin-bottom: 32px; line-height: 1; }
  .divider { width: 100%; height: 1px; background: #eee; margin: 24px 0; }

  /* Beat sheet */
  .act-row { display: flex; align-items: center; gap: 10px; margin: 20px 0 10px; }
  .act-badge { font-size: 7pt; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; padding: 3px 10px; border-radius: 20px; }
  .beat-card { border-left: 3px solid #7c3aed; padding: 10px 14px; margin-bottom: 6px; background: #f9f7ff; border-radius: 0 8px 8px 0; }
  .beat-title { font-size: 10pt; font-weight: 700; color: #1a1a2e; }
  .beat-desc { font-size: 9pt; color: #555; line-height: 1.6; margin-top: 3px; }
  .beat-page { font-size: 8pt; color: #aaa; margin-top: 4px; }

  /* Cast */
  .cast-section { margin-bottom: 24px; }
  .cast-section-title { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 3px; color: #888; margin-bottom: 10px; }
  .cast-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
  .cast-card { padding: 12px; background: #f9f7ff; border-radius: 10px; }
  .cast-name { font-size: 10pt; font-weight: 700; color: #1a1a2e; }
  .cast-dept { font-size: 8pt; color: #888; margin-top: 2px; }
  .cast-note { font-size: 8pt; color: #555; margin-top: 4px; font-style: italic; }

  /* Budget */
  .budget-hero { display: flex; gap: 32px; margin-bottom: 28px; }
  .budget-stat { background: #f9f7ff; padding: 16px 24px; border-radius: 12px; }
  .budget-stat-val { font-size: 22pt; font-weight: 900; color: #7c3aed; }
  .budget-stat-lbl { font-size: 8pt; color: #888; text-transform: uppercase; letter-spacing: 2px; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #888; padding: 8px 10px; text-align: left; border-bottom: 2px solid #eee; }
  td { font-size: 10pt; padding: 9px 10px; border-bottom: 1px solid #f0f0f0; }
  .tfoot td { font-weight: 700; border-top: 2px solid #1a1a2e; border-bottom: none; }
  .bar-wrap { width: 80px; height: 6px; background: #eee; border-radius: 3px; overflow: hidden; }
  .bar-inner { height: 100%; border-radius: 3px; }
</style>
</head>
<body>

<!-- ── Cover ──────────────────────────────────────────────────────────────── -->
<div class="page cover">
  <div class="cover-eyebrow">Production Overview · Confidential</div>
  <div class="cover-title">${esc(project.title)}</div>
  <div class="cover-accent"></div>
  ${project.logline ? `<div class="cover-logline">${esc(project.logline)}</div>` : ''}
  <div class="cover-footer">
    <span>DraftRoom</span>
    <span>${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
  </div>
</div>

${beats.length > 0 ? `
<!-- ── Beat Sheet ────────────────────────────────────────────────────────── -->
<div class="page">
  <div class="section-eye">Story Structure</div>
  <div class="page-title">Beat Sheet</div>
  ${beatsByAct.map((actBeats, ai) => {
    if (actBeats.length === 0) return '';
    const color = actColors[ai];
    return `
    <div class="act-row">
      <span class="act-badge" style="background:${color}18;color:${color};">Act ${ai + 1} · ${actLabels[ai]}</span>
      <span style="font-size:8pt;color:#bbb;">${actBeats.length} beat${actBeats.length !== 1 ? 's' : ''}</span>
    </div>
    ${actBeats.map(b => `
    <div class="beat-card" style="border-left-color:${b.color || color};">
      <div class="beat-title">${esc(b.title)}</div>
      ${b.description ? `<div class="beat-desc">${esc(b.description)}</div>` : ''}
      <div class="beat-page">Page ${b.page}</div>
    </div>`).join('')}`;
  }).join('')}
</div>` : ''}

${cast.length > 0 ? `
<!-- ── Cast & Crew ───────────────────────────────────────────────────────── -->
<div class="page">
  <div class="section-eye">People</div>
  <div class="page-title">Cast & Crew</div>
  ${Object.entries(castByCategory).map(([cat, members]) => {
    if (members.length === 0) return '';
    const catLabel = cat === 'cast' ? 'Cast' : cat === 'crew' ? 'Crew' : 'Vendors';
    return `
    <div class="cast-section">
      <div class="cast-section-title">${catLabel}</div>
      <div class="cast-grid">
        ${members.map(m => `
        <div class="cast-card">
          <div class="cast-name">${esc(m.fullName || 'Unnamed')}</div>
          ${m.department ? `<div class="cast-dept">${esc(m.department)}${m.rate ? ` · $${m.rate.toLocaleString()}/day` : ''}</div>` : ''}
          ${m.comments ? `<div class="cast-note">${esc(m.comments)}</div>` : ''}
        </div>`).join('')}
      </div>
    </div>`;
  }).join('')}
</div>` : ''}

${budget.length > 0 ? `
<!-- ── Budget ────────────────────────────────────────────────────────────── -->
<div class="page">
  <div class="section-eye">Financials</div>
  <div class="page-title">Production Budget</div>
  <div class="budget-hero">
    <div class="budget-stat">
      <div class="budget-stat-val">${fmt(totalEstimated)}</div>
      <div class="budget-stat-lbl">Estimated</div>
    </div>
    <div class="budget-stat">
      <div class="budget-stat-val" style="color:#1a1a2e;">${fmt(totalActual)}</div>
      <div class="budget-stat-lbl">Actual</div>
    </div>
    <div class="budget-stat">
      <div class="budget-stat-val" style="color:${totalActual > totalEstimated ? '#ef4444' : '#22c55e'};">${totalActual > totalEstimated ? '+' : ''}${fmt(totalActual - totalEstimated)}</div>
      <div class="budget-stat-lbl">Variance</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Department</th>
        <th style="text-align:right;">Estimated</th>
        <th style="text-align:right;">Actual</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      ${budget.map(l => {
        const pct = l.estimated ? Math.min(100, (l.actual / l.estimated) * 100) : 0;
        const bc = pct > 100 ? '#ef4444' : pct > 90 ? '#f59e0b' : '#7c3aed';
        return `<tr>
          <td>${esc(l.department)}${l.notes ? `<br><span style="font-size:8pt;color:#aaa;">${esc(l.notes)}</span>` : ''}</td>
          <td style="text-align:right;color:#666;">${fmt(l.estimated)}</td>
          <td style="text-align:right;">${fmt(l.actual)}</td>
          <td><div class="bar-wrap"><div class="bar-inner" style="width:${pct}%;background:${bc};"></div></div></td>
        </tr>`;
      }).join('')}
    </tbody>
    <tfoot>
      <tr class="tfoot">
        <td>Total</td>
        <td style="text-align:right;">${fmt(totalEstimated)}</td>
        <td style="text-align:right;">${fmt(totalActual)}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>
</div>` : ''}

</body>
</html>`;
}

// ── Convert HTML string → MediaItem ──────────────────────────────────────────

export function htmlToMediaItem(html: string, name: string): MediaItem {
  const encoded = btoa(unescape(encodeURIComponent(html)));
  return {
    id: makeId(),
    sceneIndex: -1,
    url: `data:text/html;base64,${encoded}`,
    caption: 'ai-generated',
    name,
    type: 'text/html',
    size: html.length,
    addedAt: new Date().toISOString(),
  };
}

// ── PPTX Exec Deck ────────────────────────────────────────────────────────────

export async function generateExecPPTX(project: Project): Promise<MediaItem> {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();

  const beats = project.beatSheet ?? [];
  const cast = project.castAndCrew ?? [];
  const budget = project.budget ?? [];
  const actColors: [number, number, number][] = [[124, 58, 237], [245, 158, 11], [59, 130, 246]];
  const actLabels = ['Setup', 'Confrontation', 'Resolution'];

  // ── Theme helpers ──────────────────────────────────────────────────────────
  const BG_DARK = '0a0a1a';
  const BG_SLIDE = '111128';
  const PURPLE = '7c3aed';
  const WHITE = 'ffffff';
  const GRAY = 'aaaacc';

  function titleSlide(title: string, sub: string) {
    const slide = pptx.addSlide();
    slide.background = { color: BG_DARK };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 4.2, w: '100%', h: 0.05, fill: { color: PURPLE } });
    slide.addText(title, { x: 0.7, y: 1.8, w: 8.6, h: 1.5, fontSize: 48, bold: true, color: WHITE, fontFace: 'Arial' });
    slide.addText(sub, { x: 0.7, y: 3.3, w: 8.6, h: 0.5, fontSize: 14, color: GRAY, fontFace: 'Arial' });
    return slide;
  }

  function sectionHeader(eyebrow: string, heading: string) {
    const slide = pptx.addSlide();
    slide.background = { color: BG_SLIDE };
    slide.addText(eyebrow, { x: 0.7, y: 1.6, w: 8.6, h: 0.4, fontSize: 11, bold: true, color: PURPLE, charSpacing: 5, fontFace: 'Arial' });
    slide.addText(heading, { x: 0.7, y: 2.1, w: 8.6, h: 1.2, fontSize: 36, bold: true, color: WHITE, fontFace: 'Arial' });
    return slide;
  }

  // ── Cover ──────────────────────────────────────────────────────────────────
  const cover = pptx.addSlide();
  cover.background = { color: BG_DARK };
  cover.addShape(pptx.ShapeType.rect, { x: 0.7, y: 4.4, w: 0.5, h: 0.08, fill: { color: PURPLE }, line: { color: PURPLE } });
  cover.addText('PRODUCTION OVERVIEW', { x: 0.7, y: 0.7, w: 8.6, h: 0.5, fontSize: 11, bold: true, color: PURPLE, charSpacing: 5, fontFace: 'Arial' });
  cover.addText(project.title, { x: 0.7, y: 1.4, w: 8.6, h: 2.0, fontSize: 52, bold: true, color: WHITE, fontFace: 'Arial' });
  if (project.logline) {
    cover.addText(project.logline, { x: 0.7, y: 4.6, w: 7, h: 1.2, fontSize: 13, italic: true, color: GRAY, fontFace: 'Arial' });
  }
  cover.addText(new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), {
    x: 0.7, y: 6.8, w: 8.6, h: 0.3, fontSize: 9, color: '555577', fontFace: 'Arial',
  });

  // ── Beat Sheet ─────────────────────────────────────────────────────────────
  if (beats.length > 0) {
    sectionHeader('STORY', 'Beat Sheet');

    for (let ai = 0; ai < 3; ai++) {
      const actBeats = beats.filter(b => b.act === ai + 1).sort((a, b) => a.page - b.page);
      if (actBeats.length === 0) continue;

      const slide = pptx.addSlide();
      slide.background = { color: BG_SLIDE };

      const [r, g, b_] = actColors[ai];
      const hexColor = [r, g, b_].map(c => c.toString(16).padStart(2, '0')).join('');

      slide.addText(`ACT ${ai + 1} · ${actLabels[ai]}`, {
        x: 0.5, y: 0.25, w: 9, h: 0.4,
        fontSize: 11, bold: true, color: hexColor, charSpacing: 4, fontFace: 'Arial',
      });

      const cols = Math.min(actBeats.length, 3);
      const cardW = (9.0 / cols) - 0.15;
      actBeats.slice(0, 9).forEach((beat, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = 0.5 + col * (cardW + 0.15);
        const y = 0.85 + row * 2.1;

        slide.addShape(pptx.ShapeType.rect, {
          x, y, w: cardW, h: 1.95,
          fill: { color: '1a1a3a' },
          line: { color: hexColor, width: 1.5 },
        });
        slide.addShape(pptx.ShapeType.rect, {
          x, y, w: 0.08, h: 1.95,
          fill: { color: hexColor },
          line: { color: hexColor },
        });
        slide.addText(beat.title, {
          x: x + 0.15, y: y + 0.1, w: cardW - 0.22, h: 0.4,
          fontSize: 10, bold: true, color: WHITE, fontFace: 'Arial', wrap: true,
        });
        if (beat.description) {
          slide.addText(beat.description, {
            x: x + 0.15, y: y + 0.55, w: cardW - 0.22, h: 1.15,
            fontSize: 8, color: GRAY, fontFace: 'Arial', wrap: true,
          });
        }
        slide.addText(`p.${beat.page}`, {
          x: x + 0.15, y: y + 1.75, w: cardW - 0.22, h: 0.15,
          fontSize: 7, color: '666688', fontFace: 'Arial',
        });
      });
    }
  }

  // ── Cast & Crew ────────────────────────────────────────────────────────────
  if (cast.length > 0) {
    sectionHeader('PEOPLE', 'Cast & Crew');

    const CHUNK = 9;
    for (let start = 0; start < cast.length; start += CHUNK) {
      const chunk = cast.slice(start, start + CHUNK);
      const slide = pptx.addSlide();
      slide.background = { color: BG_SLIDE };

      const cols = 3;
      const cardW = 2.9;
      chunk.forEach((m, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = 0.35 + col * 3.05;
        const y = 0.35 + row * 2.15;

        slide.addShape(pptx.ShapeType.rect, {
          x, y, w: cardW, h: 2.0,
          fill: { color: '1a1a3a' },
          line: { color: '2a2a4a', width: 1 },
        });
        slide.addText(m.fullName || 'Unnamed', {
          x: x + 0.15, y: y + 0.15, w: cardW - 0.3, h: 0.45,
          fontSize: 12, bold: true, color: WHITE, fontFace: 'Arial',
        });
        const catColor = m.category === 'cast' ? PURPLE : m.category === 'crew' ? '3b82f6' : 'f59e0b';
        slide.addText(m.category.toUpperCase(), {
          x: x + 0.15, y: y + 0.62, w: 1, h: 0.25,
          fontSize: 7, bold: true, color: catColor, charSpacing: 2, fontFace: 'Arial',
        });
        if (m.department) {
          slide.addText(m.department, {
            x: x + 0.15, y: y + 0.9, w: cardW - 0.3, h: 0.3,
            fontSize: 9, color: GRAY, fontFace: 'Arial',
          });
        }
        if (m.comments) {
          slide.addText(m.comments, {
            x: x + 0.15, y: y + 1.25, w: cardW - 0.3, h: 0.6,
            fontSize: 8, italic: true, color: '888aaa', fontFace: 'Arial', wrap: true,
          });
        }
      });
    }
  }

  // ── Budget ────────────────────────────────────────────────────────────────
  if (budget.length > 0) {
    sectionHeader('FINANCIALS', 'Production Budget');

    const totalEstimated = budget.reduce((s, l) => s + (l.estimated || 0), 0);
    const totalActual = budget.reduce((s, l) => s + (l.actual || 0), 0);

    const slide = pptx.addSlide();
    slide.background = { color: BG_SLIDE };

    // Hero stats
    const stats = [
      { label: 'ESTIMATED', value: fmt(totalEstimated), color: PURPLE },
      { label: 'ACTUAL', value: fmt(totalActual), color: WHITE },
      { label: 'VARIANCE', value: (totalActual > totalEstimated ? '+' : '') + fmt(totalActual - totalEstimated), color: totalActual > totalEstimated ? 'ef4444' : '22c55e' },
    ];
    stats.forEach((s, i) => {
      const x = 0.5 + i * 3.2;
      slide.addShape(pptx.ShapeType.rect, { x, y: 0.25, w: 3.0, h: 1.4, fill: { color: '1a1a3a' }, line: { color: '2a2a4a', width: 1 } });
      slide.addText(s.value, { x: x + 0.2, y: 0.45, w: 2.7, h: 0.7, fontSize: 22, bold: true, color: s.color, fontFace: 'Arial' });
      slide.addText(s.label, { x: x + 0.2, y: 1.2, w: 2.7, h: 0.3, fontSize: 8, bold: true, color: GRAY, charSpacing: 3, fontFace: 'Arial' });
    });

    // Table headers
    const tableTop = 1.85;
    const cols2 = [0.5, 4.5, 6.5, 7.8];
    const headers = ['Department', 'Estimated', 'Actual', ''];
    headers.forEach((h, i) => {
      slide.addText(h, { x: cols2[i], y: tableTop, w: 2.0, h: 0.3, fontSize: 8, bold: true, color: GRAY, charSpacing: 2, fontFace: 'Arial' });
    });
    slide.addShape(pptx.ShapeType.rect, { x: 0.5, y: tableTop + 0.3, w: 9.0, h: 0.02, fill: { color: '333355' }, line: { color: '333355' } });

    budget.slice(0, 10).forEach((l, i) => {
      const y = tableTop + 0.42 + i * 0.42;
      const pct = l.estimated ? Math.min(1, l.actual / l.estimated) : 0;
      const bc = pct > 1 ? 'ef4444' : pct > 0.9 ? 'f59e0b' : PURPLE;

      slide.addText(l.department, { x: cols2[0], y, w: 3.8, h: 0.35, fontSize: 10, color: WHITE, fontFace: 'Arial' });
      slide.addText(fmt(l.estimated), { x: cols2[1], y, w: 1.8, h: 0.35, fontSize: 10, color: GRAY, fontFace: 'Arial' });
      slide.addText(fmt(l.actual), { x: cols2[2], y, w: 1.2, h: 0.35, fontSize: 10, color: WHITE, fontFace: 'Arial' });
      // Mini bar
      slide.addShape(pptx.ShapeType.rect, { x: cols2[3], y: y + 0.12, w: 1.2, h: 0.1, fill: { color: '2a2a4a' }, line: { color: '2a2a4a' } });
      slide.addShape(pptx.ShapeType.rect, { x: cols2[3], y: y + 0.12, w: Math.max(0.04, 1.2 * pct), h: 0.1, fill: { color: bc }, line: { color: bc } });
    });
  }

  // ── Closing slide ──────────────────────────────────────────────────────────
  titleSlide('Thank You', 'Confidential — ' + new Date().getFullYear());

  // ── Write to blob ──────────────────────────────────────────────────────────
  const blob = await pptx.write({ outputType: 'blob' }) as Blob;
  return blobToMediaItem(blob, `${project.title} — Exec Deck.pptx`, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
}

// ── Blob → MediaItem ──────────────────────────────────────────────────────────

export function blobToMediaItem(blob: Blob, name: string, type: string): Promise<MediaItem> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve({
      id: makeId(),
      sceneIndex: -1,
      url: e.target?.result as string,
      caption: 'ai-generated',
      name,
      type,
      size: blob.size,
      addedAt: new Date().toISOString(),
    });
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
