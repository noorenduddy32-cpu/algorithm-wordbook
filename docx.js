/* 纯前端生成 .docx（OOXML + JSZip），无需服务器 */
(function () {
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // 一个段落，可指定加粗 / 字号 / 颜色 / 对齐 / 底纹
  function para(text, o) {
    o = o || {};
    let rPr = '<w:rPr>';
    if (o.bold) rPr += '<w:b/>';
    if (o.color) rPr += '<w:color w:val="' + o.color + '"/>';
    rPr += '<w:sz w:val="' + (o.sz || 21) + '"/>';
    rPr += '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Microsoft YaHei"/>';
    if (o.shd) rPr += '<w:shd w:val="clear" w:color="auto" w:fill="' + o.shd + '"/>';
    rPr += '</w:rPr>';

    let pPr = '<w:pPr>';
    if (o.align) pPr += '<w:jc w:val="' + o.align + '"/>';
    if (o.indent) pPr += '<w:ind w:left="' + o.indent + '"/>';
    if (o.before || o.after) {
      pPr += '<w:spacing ' + (o.before ? 'w:before="' + o.before + '" ' : '') +
        (o.after ? 'w:after="' + o.after + '"' : '') + '/>';
    }
    pPr += '</w:pPr>';

    return '<w:p>' + pPr + '<w:r>' + rPr + '<w:t xml:space="preserve">' + esc(text) + '</w:t></w:r></w:p>';
  }

  function cell(paras, width, o) {
    o = o || {};
    let tcPr = '<w:tcPr><w:tcW w:w="' + width + '" w:type="dxa"/>';
    if (o.shd) tcPr += '<w:shd w:val="clear" w:color="auto" w:fill="' + o.shd + '"/>';
    if (o.vcenter) tcPr += '<w:vAlign w:val="center"/>';
    tcPr += '</w:tcPr>';
    return '<w:tc>' + tcPr + paras + '</w:tc>';
  }

  const BORDER =
    '<w:tblBorders>' +
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
      .map(function (k) { return '<w:' + k + ' w:val="single" w:sz="4" w:space="0" w:color="8A94A6"/>'; })
      .join('') +
    '</w:tblBorders>';

  /* words: [{word, origin, pos, meaning, examples:[], note}]
     opts: {title, date, columns:1|2, withMeaning, withPos, withNote, withExample, withOrigin, withIndex} */
  function buildDocumentXml(words, opts) {
    const two = opts.columns === 2;
    // A4 正文宽 9638 twips；双栏时两栏等宽，中间留 400 的栏间距
    const FULL = 9638;
    const tableW = two ? Math.floor((FULL - 400) / 2) : FULL;

    // 依据勾选项决定列顺序与列宽
    const cols = [];   // {key, head, w}
    if (opts.withIndex !== false) cols.push({ key: 'i', head: '#', w: 460 });
    cols.push({ key: 'word', head: '单词', w: 0 });
    if (opts.withOrigin) cols.push({ key: 'origin', head: '原词', w: 0 });
    if (opts.withPos) cols.push({ key: 'pos', head: '词性', w: 0 });
    if (opts.withMeaning) cols.push({ key: 'meaning', head: '中文释义', w: 0 });
    if (opts.withExample) cols.push({ key: 'example', head: '例句', w: 0 });
    if (opts.withNote) cols.push({ key: 'note', head: '备注', w: 0 });

    // 把剩余宽度按权重分给弹性列（最后一步把舍入误差补给最后一列，保证合计正好等于 tableW）
    const FLEX = { word: 26, origin: 16, pos: 10, meaning: 34, example: 62, note: 20 };
    let fixed = 0, flexTotal = 0;
    cols.forEach(function (c) { if (c.w) fixed += c.w; else flexTotal += FLEX[c.key] || 10; });
    const rest = Math.max(1200, tableW - fixed);
    cols.forEach(function (c) { if (!c.w) c.w = Math.round(rest * (FLEX[c.key] || 10) / flexTotal); });
    const drift = tableW - cols.reduce(function (s, c) { return s + c.w; }, 0);
    if (cols.length && drift) cols[cols.length - 1].w += drift;

    let body = '';
    body += para(opts.title, { bold: true, sz: 36, align: 'center', after: 60 });
    const mode = two ? '双栏速记' : '完整版';
    body += para('共 ' + words.length + ' 个单词 · ' + mode + ' · 导出于 ' + opts.date,
      { sz: 18, align: 'center', color: '808080', after: 240 });

    const table = function (rowsXml) {
      return '<w:tbl>' +
        '<w:tblPr><w:tblW w:w="' + tableW + '" w:type="dxa"/><w:tblLayout w:type="fixed"/>' + BORDER + '</w:tblPr>' +
        '<w:tblGrid>' + cols.map(function (c) { return '<w:gridCol w:w="' + c.w + '"/>'; }).join('') + '</w:tblGrid>' +
        rowsXml + '</w:tbl>';
    };

    const headRow = '<w:tr><w:trPr><w:tblHeader/></w:trPr>' +
      cols.map(function (c) {
        return cell(para(c.head, { bold: true, sz: 20, align: 'center' }), c.w, { shd: 'DCE5F2', vcenter: true });
      }).join('') + '</w:tr>';

    const dataRows = words.map(function (w, idx) {
      const tds = cols.map(function (c) {
        if (c.key === 'i') return cell(para(String(idx + 1), { sz: 19, align: 'center' }), c.w, { vcenter: true });
        if (c.key === 'word') {
          return cell(para(w.word || '', { bold: true, sz: two ? 20 : 21 }), c.w, { vcenter: true });
        }
        if (c.key === 'origin') {
          const o = (w.origin || '').trim();
          return cell(o ? para(o, { sz: 18, color: '8A6D3B' }) : para('—', { sz: 18, color: '9099A8' }), c.w, { vcenter: true });
        }
        if (c.key === 'pos') {
          return cell(para(w.pos || '', { sz: 18, color: '5A6474' }), c.w, { vcenter: true });
        }
        if (c.key === 'meaning') {
          return cell(para(w.meaning || '—', { sz: 20 }), c.w, { vcenter: true });
        }
        if (c.key === 'example') {
          const ex = (w.examples || []).filter(Boolean);
          return cell(ex.length
            ? ex.map(function (e, i) { return para((i + 1) + '. ' + e, { sz: 18, after: 30 }); }).join('')
            : para('—', { sz: 18, color: '9099A8' }), c.w);
        }
        if (c.key === 'note') {
          return cell(para(w.note || '—', { sz: 18, color: 'B08000' }), c.w, { vcenter: true });
        }
        return cell(para(''), c.w);
      }).join('');
      return '<w:tr>' + tds + '</w:tr>';
    }).join('');

    if (two) {
      // 双栏：一张表先排满第一栏，再自动流入第二栏（Word 的连续分节会自动换栏）
      body += table(headRow + dataRows);
    } else {
      body += table(headRow + dataRows);
    }

    body += '<w:p/>'; // Word 要求表格后必须有一个空段落

    // 双栏用等宽（equalWidth 默认 1），两栏宽度相同，最省事也不会渲染错乱
    const sect =
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
      '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="851" w:footer="992" w:gutter="0"/>' +
      (two ? '<w:cols w:num="2" w:space="400"/>' : '<w:cols w:space="425"/>') +
      '</w:sectPr>';

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document ' + W + '><w:body>' + body + sect + '</w:body></w:document>';
  }

  const CONTENT_TYPES =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>';

  const ROOT_RELS =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>';

  const DOC_RELS =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>';

  function nowStr() {
    const d = new Date();
    const p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /* 返回 Promise<Blob>；opts 见 buildDocumentXml 的注释 */
  async function exportDocx(words, opts) {
    if (typeof JSZip === 'undefined') throw new Error('JSZip 未加载');
    const o = Object.assign({
      title: 'algorithm-wordbook', date: nowStr(), columns: 1,
      withMeaning: true, withPos: true, withNote: false,
      withExample: false, withOrigin: false, withIndex: true
    }, opts || {});

    const list = words.slice().sort(function (a, b) {
      return String(a.word).localeCompare(String(b.word), 'en');
    });

    const docXml = buildDocumentXml(list, o);

    const zip = new JSZip();
    zip.file('[Content_Types].xml', CONTENT_TYPES);
    zip.file('_rels/.rels', ROOT_RELS);
    zip.file('word/document.xml', docXml);
    zip.file('word/_rels/document.xml.rels', DOC_RELS);

    return zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      compression: 'DEFLATE'
    });
  }

  window.DocxExport = { exportDocx: exportDocx };
})();
