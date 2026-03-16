import { fromPath } from 'pdf2pic';
import { createWorker } from 'tesseract.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function extractTextFromPDF() {
  try {
    const pdfPath = path.join(__dirname, '..', 'public', 'Unmasking_AI_Bias.pdf');
    const tempDir = path.join(__dirname, '..', 'temp');
    
    // Create temp directory
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    console.log('Converting PDF to images...');
    
    // Convert PDF to images
    const options = {
      density: 200,
      saveFilename: 'page',
      savePath: tempDir,
      format: 'png',
      width: 1600,
      height: 1200
    };
    
    const convert = fromPath(pdfPath, options);
    const images = await convert.bulk(-1);
    
    console.log(`Converted ${images.length} pages to images`);
    
    // Initialize Tesseract worker
    console.log('Initializing OCR...');
    const worker = await createWorker('eng');
    
    const slides = [];
    
    // Process each image with OCR
    for (let i = 0; i < images.length; i++) {
      console.log(`Processing page ${i + 1}/${images.length}...`);
      
      const imagePath = path.join(tempDir, `page.${i + 1}.png`);
      
      const { data: { text } } = await worker.recognize(imagePath);
      
      slides.push({
        id: i + 1,
        pageNumber: i + 1,
        content: text.trim(),
        image: `/temp/page.${i + 1}.png`
      });
      
      console.log(`Page ${i + 1} text length: ${text.length} chars`);
    }
    
    await worker.terminate();
    
    // Save extracted content
    const outputData = {
      title: "Unmasking AI Bias",
      totalSlides: slides.length,
      slides: slides
    };
    
    const outputPath = path.join(__dirname, '..', 'src', 'data', 'extractedSlides.json');
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
    
    console.log('\nExtraction complete!');
    console.log(`Saved to: ${outputPath}`);
    console.log(`Total slides: ${slides.length}`);
    
    // Preview first slide
    if (slides.length > 0) {
      console.log('\n--- Slide 1 Preview ---');
      console.log(slides[0].content.substring(0, 500));
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

extractTextFromPDF();
