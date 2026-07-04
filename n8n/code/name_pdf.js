// Name PDF — n8n Code node (Run Once for All Items)
// Gives the PDF binary a friendly filename + correct mime so Gmail attaches it
// as "competitive-edge-<company>.pdf" instead of a generic name.
const item = $input.first();
const fname = $('Assemble Report').first().json.pdfFilename || 'competitive-edge-report.pdf';

if (item.binary && item.binary.data) {
  item.binary.data.fileName = fname;
  item.binary.data.fileExtension = 'pdf';
  item.binary.data.mimeType = 'application/pdf';
}

return [item];
