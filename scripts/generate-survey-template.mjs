import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import PizZip from "pizzip";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const output = resolve(scriptDirectory, "..", "templates", "survey-template.baseline.docx");
const zip = new PizZip();

zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`);

zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);

zip.file("docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Access4Lofts Survey Worksheet Baseline</dc:title>
  <dc:creator>HolaTeams</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">2026-09-10T00:00:00Z</dcterms:created>
</cp:coreProperties>`);

zip.file("docProps/app.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>HolaTeams Template Generator</Application></Properties>`);

zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>`);

zip.file("word/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="20"/><w:color w:val="17202A"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120"/></w:pPr></w:pPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="0866B5"/><w:sz w:val="36"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="0866B5"/><w:sz w:val="26"/></w:rPr></w:style>
</w:styles>`);

zip.file("word/header1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:bottom w:val="single" w:sz="12" w:color="0866B5"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="4500"/><w:gridCol w:w="4500"/></w:tblGrid><w:tr>
    <w:tc><w:p><w:r><w:rPr><w:b/><w:color w:val="0866B5"/><w:sz w:val="28"/></w:rPr><w:t>Access4Lofts</w:t></w:r></w:p></w:tc>
    <w:tc><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>{region_name}</w:t></w:r><w:r><w:br/><w:t>{region_telephone}</w:t></w:r><w:r><w:br/><w:t>{region_email}</w:t></w:r></w:p></w:tc>
  </w:tr></w:tbl>
</w:hdr>`);

zip.file("word/footer1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p><w:pPr><w:jc w:val="center"/><w:pBdr><w:top w:val="single" w:sz="8" w:color="B8C7D1"/></w:pBdr></w:pPr><w:r><w:rPr><w:color w:val="68737D"/><w:sz w:val="16"/></w:rPr><w:t>Survey worksheet / indicative prices — not a quotation</w:t></w:r></w:p>
</w:ftr>`);

zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>
  <w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>Customer Survey Worksheet</w:t></w:r></w:p>
  <w:p><w:r><w:rPr><w:b/><w:color w:val="A44100"/></w:rPr><w:t>{pricing_notice}</w:t></w:r></w:p>
  <w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D5DCE1"/><w:left w:val="single" w:sz="4" w:color="D5DCE1"/><w:bottom w:val="single" w:sz="4" w:color="D5DCE1"/><w:right w:val="single" w:sz="4" w:color="D5DCE1"/><w:insideH w:val="single" w:sz="4" w:color="D5DCE1"/><w:insideV w:val="single" w:sz="4" w:color="D5DCE1"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="2500"/><w:gridCol w:w="6500"/></w:tblGrid>
    ${detailRow("Customer", "{customer_name}")}
    ${detailRow("Email", "{customer_email}")}
    ${detailRow("Mobile", "{customer_mobile}")}
    ${detailRow("Opportunity", "{opportunity_name}")}
    ${detailRow("Property", "{street_name} {property_postcode}")}
    ${detailRow("Survey start", "{survey_start}")}
  </w:tbl>
  <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Products to discuss</w:t></w:r></w:p>
  <w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="6" w:color="9AAAB4"/><w:left w:val="single" w:sz="6" w:color="9AAAB4"/><w:bottom w:val="single" w:sz="6" w:color="9AAAB4"/><w:right w:val="single" w:sz="6" w:color="9AAAB4"/><w:insideH w:val="single" w:sz="4" w:color="CDD6DC"/><w:insideV w:val="single" w:sz="4" w:color="CDD6DC"/></w:tblBorders></w:tblPr>
    <w:tblGrid><w:gridCol w:w="500"/><w:gridCol w:w="1800"/><w:gridCol w:w="2900"/><w:gridCol w:w="1500"/><w:gridCol w:w="900"/><w:gridCol w:w="1400"/></w:tblGrid>
    <w:tr>${headerCell("#")}${headerCell("Product")}${headerCell("Description")}${headerCell("Price")}${headerCell("Qty")}${headerCell("Line net")}</w:tr>
    <w:tr>
      ${cell("{#products}{display_order}")}
      ${cell("{name}")}
      ${cell("{description}")}
      ${cell("{price_display}")}
      ${cell("{quantity}")}
      ${cell("{line_net}{/products}")}
    </w:tr>
  </w:tbl>
  <w:p/>
  <w:tbl><w:tblPr><w:tblW w:w="2600" w:type="dxa"/><w:jc w:val="right"/></w:tblPr><w:tblGrid><w:gridCol w:w="1300"/><w:gridCol w:w="1300"/></w:tblGrid>
    ${totalRow("Subtotal", "{subtotal}")}
    ${totalRow("VAT", "{vat_total}")}
    ${totalRow("Grand total", "{grand_total}", true)}
  </w:tbl>
  <w:p><w:r><w:rPr><w:i/><w:color w:val="68737D"/></w:rPr><w:t>Quantities, measurements, VAT and final totals must be reviewed before a commercial quotation is issued.</w:t></w:r></w:p>
  <w:sectPr><w:headerReference w:type="default" r:id="rId2"/><w:footerReference w:type="default" r:id="rId3"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1080" w:right="900" w:bottom="1080" w:left="900" w:header="450" w:footer="450"/></w:sectPr>
</w:body></w:document>`);

await mkdir(dirname(output), { recursive: true });
await writeFile(output, zip.generate({ type: "nodebuffer", compression: "DEFLATE" }));
process.stdout.write(`${output}\n`);

function textRun(value, bold = false) {
  return `<w:r>${bold ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${value}</w:t></w:r>`;
}

function cell(value) {
  return `<w:tc><w:tcPr><w:tcMar><w:top w:w="80" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar></w:tcPr><w:p>${textRun(value)}</w:p></w:tc>`;
}

function headerCell(value) {
  return `<w:tc><w:tcPr><w:shd w:fill="0866B5"/><w:tcMar><w:top w:w="80" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>${value}</w:t></w:r></w:p></w:tc>`;
}

function detailRow(label, value) {
  return `<w:tr>${cell(label).replace("<w:p>", "<w:p><w:pPr><w:keepNext/></w:pPr>").replace(textRun(label), textRun(label, true))}${cell(value)}</w:tr>`;
}

function totalRow(label, value, strong = false) {
  const fill = strong ? "<w:shd w:fill=\"DDECF7\"/>" : "";
  return `<w:tr><w:tc><w:tcPr>${fill}</w:tcPr><w:p>${textRun(label, true)}</w:p></w:tc><w:tc><w:tcPr>${fill}</w:tcPr><w:p><w:pPr><w:jc w:val="right"/></w:pPr>${textRun(value, strong)}</w:p></w:tc></w:tr>`;
}
