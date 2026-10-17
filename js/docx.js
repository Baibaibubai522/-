// 在浏览器里生成 Word（.docx）：A4、四个维度分章、每条 = 标题 + 照片 + 文字
// 只依赖浏览器原生 API（Blob / TextEncoder），无第三方库。

const enc = new TextEncoder();
const EMU_PER_CM = 360000;
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function concat(chunks) {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function u16(value) {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, value & 0xFFFF, true);
  return b;
}

function u32(value) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, value >>> 0, true);
  return b;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function zip(files) {
  const now = new Date();
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;

  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const file of files) {
    const name = enc.encode(file.name);
    const data = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
    const crc = crc32(data);

    const local = concat([
      u32(0x04034b50), u16(20), u16(0x0800), u16(0),
      u16(dosTime), u16(dosDate), u32(crc), u32(data.length), u32(data.length),
      u16(name.length), u16(0), name, data
    ]);
    locals.push(local);

    const central = concat([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0),
      u16(dosTime), u16(dosDate), u32(crc), u32(data.length), u32(data.length),
      u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name
    ]);
    centrals.push(central);

    offset += local.length;
  }

  const central = concat(centrals);
  const end = concat([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(central.length), u32(offset), u16(0)
  ]);
  return concat([...locals, central, end]);
}

// ---------- OOXML 片段 ----------

function run(text, { size = 24, bold = false, color = '1F1F1D', ascii = 'Times New Roman', eastAsia = '宋体' } = {}) {
  const lines = String(text).split('\n');
  const body = lines.map(line => `<w:t xml:space="preserve">${esc(line)}</w:t>`).join('<w:br/>');
  return `<w:r><w:rPr>` +
    `<w:rFonts w:ascii="${ascii}" w:hAnsi="${ascii}" w:eastAsia="${eastAsia}"/>` +
    (bold ? '<w:b/>' : '') +
    `<w:color w:val="${color}"/>` +
    `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>` +
    `</w:rPr>${body}</w:r>`;
}

function para(content, { align = '', before = 0, after = 0, line = 0, keepNext = false, keepLines = false, pageBreakBefore = false } = {}) {
  const pPr = [];
  if (pageBreakBefore) pPr.push('<w:pageBreakBefore/>');
  if (keepNext) pPr.push('<w:keepNext/>');
  if (keepLines) pPr.push('<w:keepLines/>');
  if (align) pPr.push(`<w:jc w:val="${align}"/>`);
  if (before || after || line) {
    pPr.push(`<w:spacing${before ? ` w:before="${before}"` : ''}${after ? ` w:after="${after}"` : ''}${line ? ` w:line="${line}" w:lineRule="auto"` : ''}/>`);
  }
  return `<w:p>${pPr.length ? `<w:pPr>${pPr.join('')}</w:pPr>` : ''}${content}</w:p>`;
}

function imageParagraph({ rid, cx, cy, id }) {
  const drawing = `<w:r><w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${id}" name="Picture ${id}"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic>` +
    `<pic:nvPicPr><pic:cNvPr id="${id}" name="image${id}.jpg"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline>` +
    `</w:drawing></w:r>`;
  return para(drawing, { align: 'center', after: 120, keepNext: true });
}

// ---------- 文档组装 ----------

/**
 * @param {object} options
 * @param {string} options.rangeText 例：2026年10月1日 — 10月17日
 * @param {string} options.recorder 记录人，可为空
 * @param {Array<{title:string, records:Array<{meta:string, description:string, image?:{bytes:Uint8Array,width:number,height:number}}>}>} options.chapters
 */
export function buildDocx({ title = '幼儿观察记录', rangeText = '', recorder = '', total = 0, chapters = [], imageWidthCm = 8.2, imageMaxHeightCm = 12 } = {}) {
  const body = [];
  const media = [];
  const rels = [];
  let imageId = 0;
  let docPrId = 1;

  body.push(para(
    run(title, { size: 44, bold: true, ascii: 'Microsoft YaHei', eastAsia: '微软雅黑', color: '1F1F1D' }),
    { align: 'center', after: 60 }
  ));

  const line1 = [rangeText, recorder ? `记录人：${recorder}` : ''].filter(Boolean).join(' ｜ ');
  if (line1) {
    body.push(para(
      run(line1, { size: 21, ascii: 'Microsoft YaHei', eastAsia: '微软雅黑', color: '6E6E6A' }),
      { align: 'center', after: 40 }
    ));
  }

  if (total) {
    body.push(para(
      run(`共 ${total} 条记录，按四个观察维度整理`, { size: 21, ascii: 'Microsoft YaHei', eastAsia: '微软雅黑', color: '6E6E6A' }),
      { align: 'center', after: 240 }
    ));
  }

  chapters.forEach((chapter, chapterIndex) => {
    body.push(para(
      run(chapter.title, { size: 32, bold: true, ascii: 'Microsoft YaHei', eastAsia: '微软雅黑', color: '1F1F1D' }),
      { pageBreakBefore: chapterIndex > 0, keepNext: true, after: 160 }
    ));

    chapter.records.forEach(record => {
      body.push(para(
        run(record.meta, { size: 25, bold: true, ascii: 'Microsoft YaHei', eastAsia: '微软雅黑', color: '33404E' }),
        { keepNext: true, before: 240, after: 80 }
      ));

      const image = record.image;
      if (image && image.bytes && image.bytes.length) {
        imageId += 1;
        const rid = `rIdImg${imageId}`;
        const mediaName = `image${imageId}.jpg`;

        let cx = Math.round(imageWidthCm * EMU_PER_CM);
        let cy = Math.round(cx * (image.height || 3) / (image.width || 4));
        const maxCy = Math.round(imageMaxHeightCm * EMU_PER_CM);
        if (cy > maxCy) {
          cy = maxCy;
          cx = Math.round(cy * (image.width || 4) / (image.height || 3));
        }

        body.push(imageParagraph({ rid, cx, cy, id: docPrId++ }));
        media.push({ name: `word/media/${mediaName}`, data: image.bytes });
        rels.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName}"/>`);
      }

      body.push(para(
        run(record.description || '', { size: 24, ascii: 'Times New Roman', eastAsia: '宋体', color: '33404E' }),
        { line: 360, after: 300, keepLines: true }
      ));
    });
  });

  const documentXML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"` +
    ` xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"` +
    ` xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"` +
    ` xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"` +
    ` xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<w:body>${body.join('')}` +
    `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>` +
    `<w:pgMar w:top="1247" w:right="1361" w:bottom="1247" w:left="1361" w:header="720" w:footer="720" w:gutter="0"/>` +
    `<w:cols w:space="720"/></w:sectPr>` +
    `</w:body></w:document>`;

  const stylesXML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:docDefaults><w:rPrDefault><w:rPr>` +
    `<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="宋体"/>` +
    `<w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:rPrDefault>` +
    `<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault>` +
    `</w:docDefaults>` +
    `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>` +
    `</w:styles>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Default Extension="jpg" ContentType="image/jpeg"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
    `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
    `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>` +
    `</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
    `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>` +
    `</Relationships>`;

  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    rels.join('') +
    `</Relationships>`;

  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const coreXML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"` +
    ` xmlns:dc="http://purl.org/dc/elements/1.1/"` +
    ` xmlns:dcterms="http://purl.org/dc/terms/"` +
    ` xmlns:dcmitype="http://purl.org/dc/dcmitype/"` +
    ` xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:title>${esc(title)}</dc:title><dc:creator>观察记录</dc:creator>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>` +
    `</cp:coreProperties>`;

  const appXML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"` +
    ` xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">` +
    `<Application>观察记录</Application></Properties>`;

  const files = [
    { name: '[Content_Types].xml', data: enc.encode(contentTypes) },
    { name: '_rels/.rels', data: enc.encode(rootRels) },
    { name: 'docProps/core.xml', data: enc.encode(coreXML) },
    { name: 'docProps/app.xml', data: enc.encode(appXML) },
    { name: 'word/document.xml', data: enc.encode(documentXML) },
    { name: 'word/styles.xml', data: enc.encode(stylesXML) },
    { name: 'word/_rels/document.xml.rels', data: enc.encode(documentRels) },
    ...media
  ];

  return new Blob([zip(files)], { type: DOCX_MIME });
}

