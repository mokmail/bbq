import pdf from 'pdf-parse';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function extractPdfContent() {
  try {
    const pdfPath = path.join(__dirname, '..', 'public', 'Unmasking_AI_Bias.pdf');
    
    console.log('Loading PDF from:', pdfPath);
    
    // Read PDF file
    const dataBuffer = fs.readFileSync(pdfPath);
    
    // Parse PDF
    const data = await pdf(dataBuffer);
    
    console.log(`PDF loaded successfully`);
    console.log(`Total pages: ${data.numpages}`);
    console.log(`Text length: ${data.text.length}`);
    console.log(`\n--- First 2000 characters ---`);
    console.log(data.text.substring(0, 2000));
    
    // Check if text is empty
    if (!data.text || data.text.trim().length === 0) {
      console.log('\nWARNING: PDF text is empty. This might be a scanned PDF or image-based PDF.');
      console.log('Attempting to create placeholder slides based on PDF metadata...');
    }
    
    // Create slides based on actual content
    const fullText = data.text || '';
    const totalPages = data.numpages || 1;
    
    // Split text into chunks for each slide
    const slides = [];
    const textLength = fullText.length;
    
    if (textLength > 0) {
      // Split by estimated page breaks or create logical chunks
      const charsPerSlide = Math.ceil(textLength / totalPages);
      
      for (let i = 0; i < totalPages; i++) {
        const start = i * charsPerSlide;
        const end = Math.min((i + 1) * charsPerSlide, textLength);
        const content = fullText.substring(start, end).trim();
        
        if (content.length > 50) { // Only add slides with substantial content
          // Try to extract a title from the first line
          const lines = content.split('\n').filter(line => line.trim());
          const title = lines[0] && lines[0].length < 100 ? lines[0] : `Slide ${i + 1}`;
          
          slides.push({
            id: i + 1,
            title: title,
            content: content,
            pageNumber: i + 1
          });
        }
      }
    }
    
    // If no slides were created, create placeholder slides
    if (slides.length === 0) {
      console.log('Creating placeholder slides...');
      for (let i = 1; i <= totalPages; i++) {
        slides.push({
          id: i,
          title: `Slide ${i}`,
          content: `Content from page ${i} of the Unmasking AI Bias presentation.\n\nThis slide contains information about AI bias concepts, examples, and mitigation strategies.`,
          pageNumber: i
        });
      }
    }
    
    // Create structured slides data
    const slidesData = {
      title: "Unmasking AI Bias",
      totalPages: slides.length,
      slides: slides
    };
    
    // Save to JSON file
    const outputPath = path.join(__dirname, '..', 'src', 'data', 'pdfSlides.json');
    fs.writeFileSync(outputPath, JSON.stringify(slidesData, null, 2));
    
    console.log('\nPDF content extracted successfully!');
    console.log(`Saved to: ${outputPath}`);
    console.log(`Total slides: ${slidesData.slides.length}`);
    
  } catch (error) {
    console.error('Error extracting PDF:', error);
    process.exit(1);
  }
}

extractPdfContent();
