/* 纯前端生成 .docx（OOXML + JSZip），无需服务器
   版式参考「Classic Vocabulary List」：斜体大标题 + Title/Date 行 +
   多栏 No./Word/Meaning/Example 表格 + 每行右侧勾选框 + 页脚居中页码 */
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

  // 一个段落：bold / italic / sz(半磅) / color / align / 缩进 / 段距 / 底纹
  function para(text, o) {
    o = o || {};
    const fname = o.font || 'Times New Roman';
    let rPr = '<w:rPr>' + font(fname);
    if (o.bold) rPr += '<w:b/>';
    if (o.italic) rPr += '<w:i/>';
    if (o.color) rPr += '<w:color w:val="' + o.color + '"/>';
    rPr += '<w:sz w:val="' + (o.sz || 21) + '"/></w:rPr>';

    let pPr = '<w:pPr>';
    if (o.align) pPr += '<w:jc w:val="' + o.align + '"/>';
    if (o.indent) pPr += '<w:ind w:left="' + o.indent + '"/>';
    if (o.before || o.after || o.line) {
      pPr += '<w:spacing ' +
        (o.before ? 'w:before="' + o.before + '" ' : '') +
        (o.after ? 'w:after="' + o.after + '"' : '') +
        (o.line ? ' w:line="' + o.line + '" w:lineRule="auto"' : '') + '/>';
    }
    pPr += '</w:pPr>';

    return '<w:p>' + pPr + '<w:r>' + rPr + '<w:t xml:space="preserve">' + esc(text) + '</w:t></w:r></w:p>';
  }

  // 支持多段落 + 自定义边框的单元格
  function cell(paras, width, o) {
    o = o || {};
    let tcPr = '<w:tcPr><w:tcW w:w="' + width + '" w:type="dxa"/>';
    if (o.shd) tcPr += '<w:shd w:val="clear" w:color="auto" w:fill="' + o.shd + '"/>';
    if (o.borders) tcPr += o.borders;
    if (o.vcenter) tcPr += '<w:vAlign w:val="center"/>';
    tcPr += '<w:tcMar><w:top w:w="40" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/>' +
      '<w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar>';
    tcPr += '</w:tcPr>';
    return '<w:tc>' + tcPr + paras + '</w:tc>';
  }

  function bd(kind, sz, color) {
    return '<w:' + kind + ' w:val="single" w:sz="' + sz + '" w:space="0" w:color="' + color + '"/>';
  }

  const BORDER_NONE =
    '<w:tblBorders>' +
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
      .map(function (k) { return '<w:' + k + ' w:val="none" w:sz="0" w:space="0" w:color="auto"/>'; })
      .join('') +
    '</w:tblBorders>';

  function tblBorders(o) {
    o = o || {};
    const outer = o.outer || 12;
    const inner = o.inner || 4;
    return '<w:tblBorders>' +
      bd('top', outer, '4A4A4A') + bd('left', outer, '4A4A4A') +
      bd('bottom', outer, '4A4A4A') + bd('right', outer, '4A4A4A') +
      bd('insideH', inner, 'C8C8C8') + bd('insideV', inner, 'C8C8C8') +
      '</w:tblBorders>';
  }

  // 勾选框：☐ 字符
  const BOX = '☐';

  /* ------------------------------------------------------------------
     多栏速记表（Classic Vocabulary List）
     可配置：每页栏数（columns）、每栏行数（perCol）、是否带例句列等。
     每页 = 表头 + 固定 perCol 行；每栏从上往下填满，再填下一栏。
     ------------------------------------------------------------------ */
  function buildClassic(words, opts) {
    const FULL = 9638;
    const colsPerPage = Math.max(1, Math.min(4, Number(opts.columns) || 2));
    const perCol = Math.max(1, Number(opts.perCol) || 15);
    const gapW = colsPerPage <= 2 ? 340 : 240;
    const colW = Math.floor((FULL - gapW * (colsPerPage - 1)) / colsPerPage);

    const withIdx = opts.withIndex !== false;
    const withMean = opts.withMeaning !== false;
    const withEx = opts.withExample;
    const withPos = opts.withPos !== false;
    const withNote = opts.withNote;

    // 内部分配每栏的列宽：序号 / 单词 / 中文 / 例句 / 勾选框
    const part = [];
    if (withIdx) part.push({ key: 'idx', head: 'No.', min: 280, weight: 8 });
    part.push({ key: 'word', head: 'Word', min: 520, weight: 28 });
    if (withMean) part.push({ key: 'mean', head: 'Meaning', min: 360, weight: 20 });
    if (withEx) part.push({ key: 'ex', head: 'Example', min: 440, weight: 22 });
    part.push({ key: 'box', head: '', min: 220, weight: 8 });

    const C = distribute(colW, part);

    // 表格总宽度：所有内容列 + 所有缝列
    const grid = [];
    for (let c = 0; c < colsPerPage; c++) {
      C.forEach(function (w) { grid.push(w); });
      if (c < colsPerPage - 1) grid.push(gapW);
    }

    const AVAIL = 12600;
    let ROW_H = Math.floor(AVAIL / perCol);
    ROW_H = Math.max(480, Math.min(ROW_H, 1400));
    const ROW_RULE = withEx ? 'atLeast' : 'exact';
    const rowPr = '<w:trPr><w:trHeight w:val="' + ROW_H + '" w:hRule="' + ROW_RULE + '"/></w:trPr>';

    // 缝列：左右无边框，只留上下横线，让各栏视觉上分开
    function gapCell(isHead) {
      const vnone = ['left', 'right', 'bottom'].map(function (k) {
        return '<w:' + k + ' w:val="none" w:sz="0" w:space="0" w:color="auto"/>';
      }).join('');
      const borders = isHead
        ? '<w:tcBorders><w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>' +
          '<w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>' +
          '<w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>' +
          '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="C8C8C8"/></w:tcBorders>'
        : '<w:tcBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="C8C8C8"/>' + vnone + '</w:tcBorders>';
      return '<w:tc><w:tcPr><w:tcW w:w="' + gapW + '" w:type="dxa"/>' + borders +
        '</w:tcPr><w:p/></w:tc>';
    }

    function headCells() {
      let out = '';
      part.forEach(function (p, i) {
        const text = p.head;
        const sz = p.key === 'idx' ? 18 : 20;
        const align = p.key === 'idx' || p.key === 'box' ? 'center' : '';
        out += cell(para(text, { bold: true, sz: sz, font: 'Times New Roman', align: align }), C[i], { shd: 'F0F0F0', vcenter: true });
      });
      return out;
    }

    const headRow = '<w:tr><w:trPr><w:tblHeader/><w:trHeight w:val="380" w:hRule="atLeast"/></w:trPr>' +
      interleave(headCells, colsPerPage, gapCell, true) + '</w:tr>';

    function rowCells(w, no) {
      let out = '';
      part.forEach(function (p) {
        if (p.key === 'idx') {
          out += cell(para(String(no), { sz: 18, align: 'center', font: 'Times New Roman' }), C[part.indexOf(p)], { vcenter: true });
        } else if (p.key === 'word') {
          out += cell(para(w.word || '', { bold: true, sz: 20, font: 'Times New Roman' }), C[part.indexOf(p)], { vcenter: true });
        } else if (p.key === 'mean') {
          const meaning = [];
          const pos = withPos ? (w.pos ? w.pos + ' ' : '') : '';
          meaning.push(para(pos + (w.meaning || '—'), { sz: 18, color: '404040' }));
          if (withNote && w.note) meaning.push(para('注：' + w.note, { sz: 16, color: '8A6D3B' }));
          out += cell(meaning.join(''), C[part.indexOf(p)], { vcenter: true });
        } else if (p.key === 'ex') {
          const ex = (w.examples || []).filter(Boolean);
          out += cell(ex.length
            ? ex.map(function (e) { return para(e, { sz: 15, color: '6A7280', indent: 80 }); }).join('')
            : para('—', { sz: 18, color: '9099A8' }), C[part.indexOf(p)], { vcenter: true });
        } else if (p.key === 'box') {
          out += cell(para(BOX, { sz: 22, font: 'Segoe UI Symbol', align: 'center' }), C[part.indexOf(p)], { vcenter: true });
        }
      });
      return out;
    }

    function emptyCells() {
      let out = '';
      part.forEach(function (p) {
        out += cell(para('', { sz: 18 }), C[part.indexOf(p)]);
      });
      return out;
    }

    function tableXml(pageWords, startNo) {
      let rows = '';
      for (let r = 0; r < perCol; r++) {
        let row = '<w:tr>' + rowPr;
        for (let c = 0; c < colsPerPage; c++) {
          const w = pageWords[c * perCol + r];
          const no = startNo + c * perCol + r;
          row += (w ? rowCells(w, no) : emptyCells());
          if (c < colsPerPage - 1) row += gapCell(false);
        }
        row += '</w:tr>';
        rows += row;
      }
      return '<w:tbl>' +
        '<w:tblPr><w:tblW w:w="' + FULL + '" w:type="dxa"/><w:tblLayout w:type="fixed"/>' +
        tblBorders({ outer: 12, inner: 4 }) + '</w:tblPr>' +
        '<w:tblGrid>' + grid.map(function (w) { return '<w:gridCol w:w="' + w + '"/>'; }).join('') + '</w:tblGrid>' +
        headRow + rows + '</w:tbl>';
    }

    const pageBreak = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    const perPage = perCol * colsPerPage;
    const pages = [];
    for (let i = 0; i < words.length; i += perPage) pages.push(words.slice(i, i + perPage));
    if (!pages.length) pages.push([]);

    let body = '';
    body += para(opts.title || 'Classic Vocabulary List',
      { bold: true, italic: true, sz: 40, font: 'Times New Roman', after: 100 });
    const tW = Math.floor(FULL * 0.55);
    body += '<w:tbl>' +
      '<w:tblPr><w:tblW w:w="' + FULL + '" w:type="dxa"/>' + BORDER_NONE + '</w:tblPr>' +
      '<w:tblGrid><w:gridCol w:w="' + tW + '"/><w:gridCol w:w="' + (FULL - tW) + '"/></w:tblGrid>' +
      '<w:tr>' +
      cell(para('Title: ' + (opts.docTitle || '收藏的单词'),
        { bold: true, italic: true, sz: 22, font: 'Times New Roman' }), tW, { vcenter: true }) +
      cell(para('Date:  ' + (opts.dateOnly || ''),
        { bold: true, italic: true, sz: 22, font: 'Times New Roman', align: 'right' }),
        FULL - tW, { vcenter: true }) +
      '</w:tr></w:tbl>';
    body += para('', { sz: 12, after: 60 });

    pages.forEach(function (pw, pi) {
      body += tableXml(pw, pi * perPage + 1);
      if (pi < pages.length - 1) body += pageBreak;
    });

    body += '<w:p/>';
    return body;
  }

  // 把 cells 函数重复 cols 次，中间插入 gapCell
  function interleave(cellsFn, cols, gapFn, isHead) {
    let out = '';
    for (let c = 0; c < cols; c++) {
      out += cellsFn();
      if (c < cols - 1) out += gapFn(isHead);
    }
    return out;
  }

  // 按权重分配宽度，同时保证最小宽度；返回每列宽度数组
  function distribute(total, parts) {
    const n = parts.length;
    const widths = parts.map(function () { return 0; });
    let minSum = 0;
    parts.forEach(function (p) { minSum += p.min; });
    if (minSum >= total) {
      // 放不下，按比例压缩最小值
      const scale = total / minSum;
      return parts.map(function (p) { return Math.max(120, Math.floor(p.min * scale)); });
    }
    let remaining = total - minSum;
    const totalWeight = parts.reduce(function (s, p) { return s + p.weight; }, 0);
    parts.forEach(function (p, i) {
      widths[i] = p.min + Math.floor(remaining * p.weight / totalWeight);
    });
    // 处理舍入误差
    const sum = widths.reduce(function (s, w) { return s + w; }, 0);
    if (sum !== total && n) widths[n - 1] += (total - sum);
    return widths;
  }

  /* ------------------------------------------------------------------
     完整版：单栏表格（序号 / 单词 / 词性 / 中文 / 例句）
     ------------------------------------------------------------------ */
  function buildFull(words, opts) {
    const FULL = 9638;
    const cols = [];
    if (opts.withIndex !== false) cols.push({ key: 'i', head: '#', w: 460 });
    cols.push({ key: 'word', head: '单词', w: 0 });
    if (opts.withPos !== false) cols.push({ key: 'pos', head: '词性', w: 0 });
    if (opts.withMeaning !== false) cols.push({ key: 'meaning', head: '中文释义', w: 0 });
    if (opts.withExample) cols.push({ key: 'example', head: '例句', w: 0 });
    if (opts.withNote) cols.push({ key: 'note', head: '备注', w: 0 });

    const FLEX = { word: 26, pos: 10, meaning: 34, example: 62, note: 20 };
    let fixed = 0, flexTotal = 0;
    cols.forEach(function (c) { if (c.w) fixed += c.w; else flexTotal += FLEX[c.key] || 10; });
    const rest = Math.max(1200, FULL - fixed);
    cols.forEach(function (c) { if (!c.w) c.w = Math.round(rest * (FLEX[c.key] || 10) / flexTotal); });
    const drift = FULL - cols.reduce(function (s, c) { return s + c.w; }, 0);
    if (cols.length && drift) cols[cols.length - 1].w += drift;

    let body = para(opts.title || 'algorithm-wordbook', { bold: true, italic: true, sz: 36, after: 60 });
    body += para('共 ' + words.length + ' 个单词 · 导出于 ' + opts.date,
      { sz: 18, align: 'center', color: '808080', after: 240 });

    const headRow = '<w:tr><w:trPr><w:tblHeader/></w:trPr>' +
      cols.map(function (c) {
        return cell(para(c.head, { bold: true, sz: 20, align: 'center' }), c.w, { shd: 'DCE5F2', vcenter: true });
      }).join('') + '</w:tr>';

    const dataRows = words.map(function (w, idx) {
      const tds = cols.map(function (c) {
        if (c.key === 'i') return cell(para(String(idx + 1), { sz: 19, align: 'center' }), c.w, { vcenter: true });
        if (c.key === 'word') return cell(para(w.word || '', { bold: true, sz: 21 }), c.w, { vcenter: true });
        if (c.key === 'pos') return cell(para(w.pos || '', { sz: 18, color: '5A6474' }), c.w, { vcenter: true });
        if (c.key === 'meaning') return cell(para(w.meaning || '—', { sz: 20 }), c.w, { vcenter: true });
        if (c.key === 'example') {
          const ex = (w.examples || []).filter(Boolean);
          return cell(ex.length
            ? ex.map(function (e) { return para(e, { sz: 17, after: 30, indent: 120 }); }).join('')
            : para('—', { sz: 18, color: '9099A8' }), c.w);
        }
        if (c.key === 'note') return cell(para(w.note || '—', { sz: 18, color: 'B08000' }), c.w, { vcenter: true });
        return cell(para(''), c.w);
      }).join('');
      return '<w:tr>' + tds + '</w:tr>';
    }).join('');

    body += '<w:tbl>' +
      '<w:tblPr><w:tblW w:w="' + FULL + '" w:type="dxa"/><w:tblLayout w:type="fixed"/>' + tblBorders({ outer: 8, inner: 4 }) + '</w:tblPr>' +
      '<w:tblGrid>' + cols.map(function (c) { return '<w:gridCol w:w="' + c.w + '"/>'; }).join('') + '</w:tblGrid>' +
      headRow + dataRows + '</w:tbl>';
    body += '<w:p/>';
    return body;
  }

  function buildDocumentXml(words, opts) {
    // 新版用 opts.layout 区分；旧版没传 layout 时靠 columns/perPage/perCol 兜底
    const layout = opts.layout || (opts.columns > 1 || opts.perPage != null || opts.perCol != null ? 'classic' : 'full');
    const body = layout === 'classic' ? buildClassic(words, opts) : buildFull(words, opts);
    const sect =
      '<w:sectPr>' +
      '<w:footerReference w:type="default" r:id="rIdFtr"/>' +
      '<w:pgSz w:w="11906" w:h="16838"/>' +
      '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" ' +
      'w:header="851" w:footer="680" w:gutter="0"/>' +
      '</w:sectPr>';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document ' + W + ' ' + R_NS + '><w:body>' + body + sect + '</w:body></w:document>';
  }

  // 页脚：居中的 "第 X 页"，用 PAGE 域
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
    '</Relationships>';

  function nowStr() {
    const d = new Date();
    const p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function dateOnly() {
    const d = new Date();
    const p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return p(d.getMonth() + 1) + ' / ' + p(d.getDate()) + ' / ' + d.getFullYear();
  }

  async function exportDocx(words, opts) {
    if (typeof JSZip === 'undefined') throw new Error('JSZip 未加载');
    const o = Object.assign({
      title: 'Classic Vocabulary List', docTitle: '收藏的单词', date: nowStr(),
      dateOnly: dateOnly(), columns: 2, perCol: 15,
      withMeaning: true, withPos: true, withNote: false,
      withExample: false, withIndex: true
    }, opts || {});

    const list = words.slice();
    const docXml = buildDocumentXml(list, o);

    const zip = new JSZip();
    zip.file('[Content_Types].xml', CONTENT_TYPES);
    zip.file('_rels/.rels', ROOT_RELS);
    zip.file('word/document.xml', docXml);
    zip.file('word/footer1.xml', FOOTER);
    zip.file('word/_rels/document.xml.rels', DOC_RELS);

    return zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      compression: 'DEFLATE'
    });
  }

  window.DocxExport = { exportDocx: exportDocx };
})();