import PDFParser from 'pdf2json';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function extractPdfText() {
  return new Promise((resolve, reject) => {
    const pdfPath = path.join(__dirname, '..', 'public', 'Unmasking_AI_Bias.pdf');
    
    console.log('Extracting text from PDF:', pdfPath);
    
    const pdfParser = new PDFParser();
    
    pdfParser.on('pdfParser_dataError', errData => {
      console.error('PDF parsing error:', errData.parserError);
      reject(errData.parserError);
    });
    
    pdfParser.on('pdfParser_dataReady', pdfData => {
      const text = pdfParser.getRawTextContent();
      console.log('PDF text extracted successfully!');
      console.log('Text length:', text.length);
      console.log('\n--- First 2000 characters ---');
      console.log(text.substring(0, 2000));
      resolve(text);
    });
    
    pdfParser.loadPDF(pdfPath);
  });
}

async function main() {
  try {
    const text = await extractPdfText();
    
    // Save raw text for analysis
    const outputPath = path.join(__dirname, '..', 'src', 'data', 'pdfRawText.txt');
    fs.writeFileSync(outputPath, text);
    
    console.log('\nRaw text saved to:', outputPath);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
