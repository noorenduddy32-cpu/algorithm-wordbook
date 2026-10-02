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

  /* words: [{word, origin, pos, meaning, examples:[], note}] */
  function buildDocumentXml(words, meta) {
    const COLS = [560, 1420, 880, 2180, 4598]; // 合计 9638 twips ≈ A4 正文宽度
    const HEAD = ['#', '单词', '词性', '中文释义', '例句'];

    let body = '';
    body += para(meta.title, { bold: true, sz: 36, align: 'center', after: 60 });
    body += para('共 ' + words.length + ' 个单词 · 导出于 ' + meta.date,
      { sz: 18, align: 'center', color: '808080', after: 240 });

    let rows = '';

    // 表头
    rows += '<w:tr><w:trPr><w:tblHeader/></w:trPr>' +
      HEAD.map(function (h, i) {
        return cell(para(h, { bold: true, sz: 20, align: 'center' }), COLS[i], { shd: 'DCE5F2', vcenter: true });
      }).join('') + '</w:tr>';

    // 数据行
    words.forEach(function (w, idx) {
      const exParas = (w.examples && w.examples.length)
        ? w.examples.map(function (e, i) {
          return para((i + 1) + '. ' + e, { sz: 19, indent: 0, after: 40 });
        }).join('')
        : para('—', { sz: 19, color: '9099A8' });

      const cells = [
        cell(para(String(idx + 1), { sz: 20, align: 'center' }), COLS[0], { vcenter: true }),
        cell(para(w.word, { bold: true, sz: 21 }), COLS[1], { vcenter: true }),
        cell(para(w.pos || '', { sz: 19, color: '5A6474' }), COLS[2], { vcenter: true }),
        cell(para(w.meaning || '', { sz: 21 }), COLS[3], { vcenter: true }),
        cell(exParas + (w.note ? para('注：' + w.note, { sz: 18, color: 'B08000' }) : ''), COLS[4])
      ];
      rows += '<w:tr>' + cells.join('') + '</w:tr>';
    });

    body +=
      '<w:tbl>' +
      '<w:tblPr><w:tblW w:w="9638" w:type="dxa"/><w:tblLayout w:type="fixed"/>' + BORDER + '</w:tblPr>' +
      '<w:tblGrid>' + COLS.map(function (c) { return '<w:gridCol w:w="' + c + '"/>'; }).join('') + '</w:tblGrid>' +
      rows +
      '</w:tbl>';

    body += '<w:p/>'; // Word 要求表格后必须有一个空段落

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document ' + W + '><w:body>' + body +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
      '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="851" w:footer="992" w:gutter="0"/>' +
      '</w:sectPr></w:body></w:document>';
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

  /* 返回 Promise<Blob> */
  async function exportDocx(words, title) {
    if (typeof JSZip === 'undefined') throw new Error('JSZip 未加载');

    const list = words.slice().sort(function (a, b) {
      return String(a.word).localeCompare(String(b.word), 'en');
    });

    const docXml = buildDocumentXml(list, { title: title || 'algorithm-wordbook', date: nowStr() });

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
