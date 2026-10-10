/* 文章批量导出 Word（复用 docx.js 的 OOXML 包结构 + JSZip）
   把每篇文章的 HTML 正文转换为真正的 Word 段落 / 标题 / 列表 / 表格 / 代码块，
   而不是像单词本那样只排一张表格。 */
(function () {
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const R_NS = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function font(name) {
    return '<w:rFonts w:ascii="' + name + '" w:hAnsi="' + name +
      '" w:eastAsia="Microsoft YaHei" w:cs="' + name + '"/>';
  }

  // 一个段落（带样式）
  function para(text, o) {
    o = o || {};
    const fname = o.mono ? 'Consolas' : 'Microsoft YaHei';
    let rPr = '<w:rPr>' + font(fname);
    if (o.bold) rPr += '<w:b/>';
    if (o.italic) rPr += '<w:i/>';
    if (o.underline) rPr += '<w:u w:val="single"/>';
    if (o.color) rPr += '<w:color w:val="' + o.color + '"/>';
    rPr += '<w:sz w:val="' + (o.sz || 21) + '"/></w:rPr>';

    let pPr = '<w:pPr>' + (o.style ? '<w:pStyle w:val="' + o.style + '"/>' : '');
    if (o.align) pPr += '<w:jc w:val="' + o.align + '"/>';
    if (o.indent) pPr += '<w:ind w:left="' + o.indent + '"' + (o.hanging != null ? ' w:hanging="' + o.hanging + '"' : '') + '/>';
    if (o.shd) pPr += '<w:shd w:val="clear" w:color="auto" w:fill="' + o.shd + '"/>';
    if (o.before || o.after || o.line) {
      pPr += '<w:spacing ' +
        (o.before ? 'w:before="' + o.before + '" ' : '') +
        (o.after ? 'w:after="' + o.after + '"' : '') +
        (o.line ? ' w:line="' + o.line + '" w:lineRule="auto"' : '') + '/>';
    }
    pPr += '</w:pPr>';

    const textXml = String(text).split('\n').map(function (line) { return '<w:t xml:space="preserve">' + esc(line) + '</w:t>'; }).join('<w:br/>');
    return '<w:p>' + pPr + '<w:r>' + rPr + textXml + '</w:r></w:p>';
  }

  /* ---------- 行内样式收集（bold / italic / code / u） ---------- */
  function collectRuns(node, style, arr) {
    style = style || {};
    const kids = node.childNodes;
    for (let i = 0; i < kids.length; i++) {
      const n = kids[i];
      if (n.nodeType === 3) {
        if (n.textContent) arr.push({ text: n.textContent, style: style });
      } else if (n.nodeType === 1) {
        const t = n.tagName.toLowerCase();
        if (t === 'br') arr.push({ br: true });
        else {
          const s2 = Object.assign({}, style);
          if (t === 'strong' || t === 'b') s2.bold = true;
          else if (t === 'em' || t === 'i') s2.italic = true;
          else if (t === 'code') s2.mono = true;
          else if (t === 'u') s2.underline = true;
          else if (t === 's' || t === 'strike' || t === 'del') s2.strike = true;
          const color = n.style && n.style.color || n.getAttribute('color');
          if (color) {
            const rgb = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
            if (rgb) s2.color = rgb.slice(1).map(function (v) { return Number(v).toString(16).padStart(2, '0'); }).join('');
            else if (/^#[a-f0-9]{6}$/i.test(color)) s2.color = color.slice(1);
          }
          collectRuns(n, s2, arr);
        }
      }
    }
  }

  function mkRun(r) {
    if (r.br) return '<w:r><w:br/></w:r>';
    const s = r.style || {};
    const fname = s.mono ? 'Consolas' : 'Microsoft YaHei';
    let rPr = '<w:rPr>' + font(fname);
    if (s.bold) rPr += '<w:b/>';
    if (s.italic) rPr += '<w:i/>';
    if (s.underline) rPr += '<w:u w:val="single"/>';
    if (s.strike) rPr += '<w:strike/>';
    if (s.color) rPr += '<w:color w:val="' + s.color + '"/>';
    rPr += '<w:sz w:val="' + (s.sz || 21) + '"/></w:rPr>';
    return '<w:r>' + rPr + '<w:t xml:space="preserve">' + esc(r.text) + '</w:t></w:r>';
  }

  function runsToXml(arr) {
    let out = '';
    for (let i = 0; i < arr.length; i++) out += mkRun(arr[i]);
    return out;
  }

  function paraRuns(arr, o) {
    o = o || {};
    let pPr = '<w:pPr>' + (o.style ? '<w:pStyle w:val="' + o.style + '"/>' : '');
    if (o.numId) pPr += '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="' + o.numId + '"/></w:numPr>';
    if (o.align) pPr += '<w:jc w:val="' + o.align + '"/>';
    if (o.indent) pPr += '<w:ind w:left="' + o.indent + '"' + (o.hanging != null ? ' w:hanging="' + o.hanging + '"' : '') + '/>';
    if (o.before || o.after || o.line) {
      pPr += '<w:spacing ' +
        (o.before ? 'w:before="' + o.before + '" ' : '') +
        (o.after ? 'w:after="' + o.after + '"' : '') +
        (o.line ? ' w:line="' + o.line + '" w:lineRule="auto"' : '') + '/>';
    }
    pPr += '</w:pPr>';
    return '<w:p>' + pPr + runsToXml(arr) + '</w:p>';
  }

  function paraFromNode(node, o) {
    o = o || {};
    const arr = [];
    collectRuns(node, o, arr);
    if (node.style && node.style.textAlign) o.align = node.style.textAlign === 'justify' ? 'both' : node.style.textAlign;
    return paraRuns(arr, o);
  }

  /* ---------- 块级转换 ---------- */

  function listToXml(ul, ordered) {
    const items = ul.querySelectorAll(':scope > li');
    let out = '';
    items.forEach(function (li, i) {
      const arr = [];
      collectRuns(li, {}, arr);
      out += paraRuns(arr, { sz: 21, after: 60, numId: ordered ? 2 : 1 });
    });
    return out;
  }

  function tableToXml(table) {
    const rows = table.querySelectorAll('tr');
    if (!rows.length) return '';
    let maxCols = 0;
    const rowCells = [];
    rows.forEach(function (tr) {
      const cells = tr.querySelectorAll(':scope > td, :scope > th');
      rowCells.push(cells);
      if (cells.length > maxCols) maxCols = cells.length;
    });
    if (!maxCols) return '';
    const FULL = 9638;
    const cw = Math.floor(FULL / maxCols);
    const widths = Array.from({ length: maxCols }, function (_, i) { return cw + (i === maxCols - 1 ? FULL % maxCols : 0); });
    const gridXml = [];
    for (let i = 0; i < maxCols; i++) gridXml.push('<w:gridCol w:w="' + widths[i] + '"/>');
    const borders = '<w:tblBorders>' +
      ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(function (k) {
        return '<w:' + k + ' w:val="single" w:sz="4" w:space="0" w:color="B0B0B0"/>';
      }).join('') + '</w:tblBorders>';
    let body = '';
    rowCells.forEach(function (cells) {
      let tds = '';
      for (let ci = 0; ci < maxCols; ci++) {
        const cell = cells[ci];
        const isHead = cell && cell.tagName.toLowerCase() === 'th';
        const arr = [];
        if (cell) collectRuns(cell, { bold: isHead }, arr);
        const pPr = '<w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr>';
        const tcPr = '<w:tcPr><w:tcW w:w="' + widths[ci] + '" w:type="dxa"/>' +
          '<w:tcMar><w:top w:w="40" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/>' +
          '<w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar>' +
          (isHead ? '<w:shd w:val="clear" w:color="auto" w:fill="DCE5F2"/>' : '') + '</w:tcPr>';
        const runs = arr.length ? runsToXml(arr) : '<w:r><w:t></w:t></w:r>';
        tds += '<w:tc>' + tcPr + '<w:p>' + pPr + runs + '</w:p></w:tc>';
      }
      body += '<w:tr>' + tds + '</w:tr>';
    });
    return '<w:tbl><w:tblPr><w:tblW w:w="' + FULL + '" w:type="dxa"/><w:tblLayout w:type="fixed"/>' +
      borders + '</w:tblPr><w:tblGrid>' + gridXml.join('') + '</w:tblGrid>' + body + '</w:tbl><w:p/>';
  }

  function walkChildren(node) {
    let out = '';
    const kids = node.childNodes;
    for (let i = 0; i < kids.length; i++) {
      const c = kids[i];
      if (c.nodeType === 3) {
        const txt = (c.textContent || '').trim();
        if (txt) out += para(txt, { sz: 21, after: 120 });
      } else if (c.nodeType === 1) {
        out += blockToXml(c);
      }
    }
    return out;
  }

  function blockToXml(node) {
    const t = node.tagName.toLowerCase();
    if (t === 'h1') return paraFromNode(node, { style: 'Heading1', sz: 32, bold: true, color: '1F3864', before: 240, after: 120 });
    if (t === 'h2') return paraFromNode(node, { style: 'Heading2', sz: 27, bold: true, color: '1F3864', before: 200, after: 100 });
    if (t === 'h3') return paraFromNode(node, { style: 'Heading3', sz: 23, bold: true, before: 160, after: 80 });
    if (t === 'h4' || t === 'h5') return paraFromNode(node, { style: t === 'h4' ? 'Heading4' : 'Heading5', sz: 22, bold: true, before: 140, after: 80 });
    if (t === 'p') return paraFromNode(node, { sz: 21, after: 120, line: 312 });
    if (t === 'blockquote') return paraFromNode(node, { sz: 21, after: 120, indent: 360, color: '595959', line: 312 });
    if (t === 'pre' || t === 'code') {
      const text = (node.textContent || '').replace(/\n+$/, '').replace(/^\n+/, '');
      return para(text, { mono: true, sz: 19, after: 120, indent: 200, color: '1F3864', shd: 'F2F2F2' });
    }
    if (t === 'ul') return listToXml(node, false);
    if (t === 'ol') return listToXml(node, true);
    if (t === 'table') return tableToXml(node);
    if (t === 'hr') return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="C8C8C8"/></w:pBdr></w:pPr></w:p>';
    if (t === 'div' || t === 'section' || t === 'article' || t === 'figure' || t === 'details') return walkChildren(node);
    return paraFromNode(node, { sz: 21, after: 120 });
  }

  function htmlToDocx(html) {
    const div = document.createElement('div');
    div.innerHTML = html || '';
    return walkChildren(div);
  }

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 10);
    const p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function buildNotesDocx(notes, opts) {
    let body = '';
    body += para(opts.title || '算法学习笔记本', { bold: true, sz: 40, color: '1F3864', after: 80 });
    body += para('共 ' + notes.length + ' 篇 · 导出于 ' + (opts.date || ''), { sz: 18, color: '808080', after: 240 });
    notes.forEach(function (n, i) {
      if (i) body += '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="8" w:space="6" w:color="1F3864"/></w:pBdr></w:pPr></w:p>';
      body += para((i + 1) + '. ' + (n.title || '无标题'), { bold: true, sz: 28, color: '1F3864', before: 160, after: 80 });
      const meta = [];
      if (n.tags && n.tags.length) meta.push('标签：' + n.tags.join('、'));
      if (n.category) meta.push('栏目：' + n.category);
      if (n.updated_at) meta.push('更新：' + fmtDate(n.updated_at));
      if (n.views) meta.push('浏览：' + n.views);
      if (meta.length) body += para(meta.join('     '), { sz: 17, color: '808080', after: 100 });
      body += htmlToDocx(n.content || '');
      body += '<w:p/>';
    });
    return body;
  }

  /* ---------- OOXML 包结构（与 docx.js 一致） ---------- */
  const FOOTER =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:ftr ' + W + ' ' + R_NS + '><w:p><w:pPr><w:jc w:val="center"/></w:pPr>' +
    '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Microsoft YaHei"/>' +
    '<w:sz w:val="18"/><w:color w:val="666666"/></w:rPr><w:t xml:space="preserve">- </w:t></w:r>' +
    '<w:r><w:fldChar w:fldCharType="begin"/></w:r>' +
    '<w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>' +
    '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' +
    '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Microsoft YaHei"/>' +
    '<w:sz w:val="18"/><w:color w:val="666666"/></w:rPr><w:t>1</w:t></w:r>' +
    '<w:r><w:fldChar w:fldCharType="end"/></w:r>' +
    '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Microsoft YaHei"/>' +
    '<w:sz w:val="18"/><w:color w:val="666666"/></w:rPr><w:t xml:space="preserve"> -</w:t></w:r>' +
    '</w:p></w:ftr>';

  const CONTENT_TYPES =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
    '</Types>';

  const ROOT_RELS =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>';

  const DOC_RELS =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rIdFtr" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>' +
    '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '<Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>' +
    '</Relationships>';

  const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ' + W + '>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr>' + font('Microsoft YaHei') + '<w:sz w:val="21"/></w:rPr></w:style>' +
    [1, 2, 3, 4, 5].map(function (n) {
      return '<w:style w:type="paragraph" w:styleId="Heading' + n + '"><w:name w:val="heading ' + n + '"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:outlineLvl w:val="' + (n - 1) + '"/></w:pPr><w:rPr><w:b/></w:rPr></w:style>';
    }).join('') + '</w:styles>';
  const NUMBERING = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering ' + W + '>' +
    [1, 2].map(function (n) {
      return '<w:abstractNum w:abstractNumId="' + n + '"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="' + (n === 1 ? 'bullet' : 'decimal') + '"/><w:lvlText w:val="' + (n === 1 ? '•' : '%1.') + '"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="240"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="' + n + '"><w:abstractNumId w:val="' + n + '"/></w:num>';
    }).join('') + '</w:numbering>';

  async function exportNotesDocx(notes, opts) {
    if (typeof JSZip === 'undefined') throw new Error('JSZip 未加载');
    const o = Object.assign({ title: '算法学习笔记本 · 文章导出', date: '', count: notes.length }, opts || {});
    const b = buildNotesDocx(notes, o);
    const sect =
      '<w:sectPr>' +
      '<w:footerReference w:type="default" r:id="rIdFtr"/>' +
      '<w:pgSz w:w="11906" w:h="16838"/>' +
      '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="851" w:footer="680" w:gutter="0"/>' +
      '</w:sectPr>';
    const docXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document ' + W + ' ' + R_NS + '><w:body>' + b + sect + '</w:body></w:document>';

    const zip = new JSZip();
    zip.file('[Content_Types].xml', CONTENT_TYPES);
    zip.file('_rels/.rels', ROOT_RELS);
    zip.file('word/document.xml', docXml);
    zip.file('word/footer1.xml', FOOTER);
    zip.file('word/styles.xml', STYLES);
    zip.file('word/numbering.xml', NUMBERING);
    zip.file('word/_rels/document.xml.rels', DOC_RELS);
    return zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      compression: 'DEFLATE'
    });
  }

  window.DocxExport = Object.assign(window.DocxExport || {}, { exportNotesDocx: exportNotesDocx });
})();
