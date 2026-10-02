/* 纯前端生成 .docx（OOXML + JSZip），无需服务器
   版式参考「Classic Vocabulary List」：斜体大标题 + Title/Date 行 +
   双栏 No./Word/Meaning 表格 + 每行右侧勾选框 + 页脚居中页码 */
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
    rPr += '<w:sz w:val="' + (o.sz || 21) + '"/><w:szCs w:val="' + (o.sz || 21) + '"/>';
    rPr += '</w:rPr>';

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
    const outer = o.outer || 12;      // 上下左右粗边
    const inner = o.inner || 4;      // 内部细虚线
    return '<w:tblBorders>' +
      bd('top', outer, '4A4A4A') + bd('left', outer, '4A4A4A') +
      bd('bottom', outer, '4A4A4A') + bd('right', outer, '4A4A4A') +
      bd('insideH', inner, 'C8C8C8') + bd('insideV', inner, 'C8C8C8') +
      '</w:tblBorders>';
  }

  // 勾选框：☐ 字符，Times New Roman 有这个字形
  const BOX = '☐';

  /* ------------------------------------------------------------------
     双栏速记表（默认版式，对应图 2）
     布局：一张表 6 列 = [No. | Word | Meaning | ☐] × 2 栏
     ------------------------------------------------------------------ */
  function buildClassic(words, opts) {
    const FULL = 9638;               // A4 正文宽（twips）
    const GAP = 340;                 // 两栏之间的缝
    const colW = Math.floor((FULL - GAP) / 2);   // 每栏宽
    // No. | Word | Meaning | ☐ —— Word 吃掉栏内剩余宽度，四列合计正好等于 colW
    const NO = 520, MEAN = 340, BOXW = 280;
    const C = [NO, colW - NO - MEAN - BOXW, MEAN, BOXW];
    const half = Math.ceil(words.length / 2);
    // 9 列：左栏 4 列 + 中间 1 个空列（GAP）+ 右栏 4 列，合计正好等于 FULL
    const grid = [].concat(C, [GAP], C);

    // 中间那个缝列：左右无边框，只有横线跟上下对齐，两栏才真的分开
    const gapCell = function (isHead) {
      const vnone = ['left', 'right', 'bottom'].map(function (k) {
        return '<w:' + k + ' w:val="none" w:sz="0" w:space="0" w:color="auto"/>';
      }).join('');
      const borders = isHead
        ? '<w:tcBorders><w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>' +
          '<w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>' +
          '<w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>' +
          '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="C8C8C8"/></w:tcBorders>'
        : '<w:tcBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="C8C8C8"/>' + vnone + '</w:tcBorders>';
      return '<w:tc><w:tcPr><w:tcW w:w="' + GAP + '" w:type="dxa"/>' + borders +
        '</w:tcPr><w:p/></w:tc>';
    };

    let body = '';

    // 标题
    body += para(opts.title || 'Classic Vocabulary List',
      { bold: true, italic: true, sz: 40, font: 'Times New Roman', after: 100 });

    // Title / Date 行
    const titleCell = para('Title: ' + (opts.docTitle || '收藏的单词'),
      { bold: true, italic: true, sz: 22, font: 'Times New Roman' });
    const dateCell = para('Date:  ' + (opts.dateOnly || ''),
      { bold: true, italic: true, sz: 22, font: 'Times New Roman', align: 'right' });
    body += '<w:tbl>' +
      '<w:tblPr><w:tblW w:w="' + FULL + '" w:type="dxa"/>' + BORDER_NONE + '</w:tblPr>' +
      '<w:tblGrid><w:gridCol w:w="' + Math.floor(FULL * 0.55) + '"/><w:gridCol w:w="' + (FULL - Math.floor(FULL * 0.55)) + '"/></w:tblGrid>' +
      '<w:tr>' +
      cell(titleCell, Math.floor(FULL * 0.55), { vcenter: true }) +
      cell(dateCell, FULL - Math.floor(FULL * 0.55), { vcenter: true }) +
      '</w:tr></w:tbl>';

    body += para('', { sz: 12, after: 60 });

    // 表头（两栏各一份，中间夹一个空缝列）
    const headCells = function () {
      return cell(para('', { sz: 18 }), C[0], { shd: 'F0F0F0', vcenter: true }) +
        cell(para('Word', { bold: true, sz: 20, font: 'Times New Roman' }), C[1], { shd: 'F0F0F0', vcenter: true }) +
        cell(para('Meaning', { bold: true, sz: 20, font: 'Times New Roman' }), C[2], { shd: 'F0F0F0', vcenter: true }) +
        cell(para('', { sz: 18 }), C[3], { shd: 'F0F0F0', vcenter: true });
    };
    const headRow = '<w:tr><w:trPr><w:tblHeader/></w:trPr>' +
      headCells() + gapCell(true) + headCells() + '</w:tr>';

    // 数据行：左栏第 1..half，右栏第 half+1..end
    const rowCells = function (w, no) {
      const meaning = [];
      const pos = opts.withPos === false ? '' : (w.pos ? w.pos + ' ' : '');
      meaning.push(para(pos + (w.meaning || '—'), { sz: 18, color: '404040' }));
      if (opts.withOrigin && w.origin) meaning.push(para('原词 ' + w.origin, { sz: 16, color: '8A6D3B' }));
      if (opts.withNote && w.note) meaning.push(para('注：' + w.note, { sz: 16, color: '8A6D3B' }));
      if (opts.withExample) {
        (w.examples || []).filter(Boolean).forEach(function (e) {
          meaning.push(para(e, { sz: 15, color: '6A7280', indent: 120 }));
        });
      }
      return cell(para(String(no), { sz: 18, align: 'center', font: 'Times New Roman' }), C[0], { vcenter: true }) +
        cell(para(w.word || '', { bold: true, sz: 20, font: 'Times New Roman' }), C[1], { vcenter: true }) +
        cell(meaning.join(''), C[2], { vcenter: true }) +
        cell(para(BOX, { sz: 22, font: 'Segoe UI Symbol', align: 'center' }), C[3], { vcenter: true });
    };

    const emptyCells = function () {
      return cell(para('', { sz: 18 }), C[0]) + cell(para('', { sz: 18 }), C[1]) +
        cell(para('', { sz: 18 }), C[2]) + cell(para('', { sz: 18 }), C[3]);
    };

    let rows = '';
    for (let i = 0; i < half; i++) {
      const lw = words[i];
      const rw = words[i + half];
      rows += '<w:tr>' + rowCells(lw, i + 1) + gapCell(false) +
        (rw ? rowCells(rw, i + half + 1) : emptyCells()) + '</w:tr>';
    }

    body += '<w:tbl>' +
      '<w:tblPr><w:tblW w:w="' + FULL + '" w:type="dxa"/><w:tblLayout w:type="fixed"/>' +
      tblBorders({ outer: 12, inner: 4 }) + '</w:tblPr>' +
      '<w:tblGrid>' + grid.map(function (w) { return '<w:gridCol w:w="' + w + '"/>'; }).join('') + '</w:tblGrid>' +
      headRow + rows + '</w:tbl>';

    body += '<w:p/>';
    return body;
  }

  /* ------------------------------------------------------------------
     完整版：单栏表格（序号 / 单词 / 词性 / 中文 / 例句）
     ------------------------------------------------------------------ */
  function buildFull(words, opts) {
    const FULL = 9638;
    const cols = [];
    if (opts.withIndex !== false) cols.push({ key: 'i', head: '#', w: 460 });
    cols.push({ key: 'word', head: '单词', w: 0 });
    if (opts.withOrigin) cols.push({ key: 'origin', head: '原词', w: 0 });
    if (opts.withPos !== false) cols.push({ key: 'pos', head: '词性', w: 0 });
    if (opts.withMeaning !== false) cols.push({ key: 'meaning', head: '中文释义', w: 0 });
    if (opts.withExample) cols.push({ key: 'example', head: '例句', w: 0 });
    if (opts.withNote) cols.push({ key: 'note', head: '备注', w: 0 });

    const FLEX = { word: 26, origin: 16, pos: 10, meaning: 34, example: 62, note: 20 };
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
        if (c.key === 'origin') {
          const o = (w.origin || '').trim();
          return cell(o ? para(o, { sz: 18, color: '8A6D3B' }) : para('—', { sz: 18, color: '9099A8' }), c.w, { vcenter: true });
        }
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
    const two = opts.columns === 2;
    const body = two ? buildClassic(words, opts) : buildFull(words, opts);
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

  // 页脚：居中的 "第 X 页"，用 PAGE 域，Word 打开时会自动算
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

  /* 返回 Promise<Blob>；opts 见 buildClassic 里的说明 */
  async function exportDocx(words, opts) {
    if (typeof JSZip === 'undefined') throw new Error('JSZip 未加载');
    const o = Object.assign({
      title: 'Classic Vocabulary List', docTitle: '收藏的单词', date: nowStr(),
      dateOnly: dateOnly(), columns: 2,
      withMeaning: true, withPos: true, withNote: false,
      withExample: false, withOrigin: false, withIndex: true
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
