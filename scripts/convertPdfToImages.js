import { fromPath } from 'pdf2pic';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function convertPdfToImages() {
  try {
    const pdfPath = path.join(__dirname, '..', 'public', 'Unmasking_AI_Bias.pdf');
    const outputDir = path.join(__dirname, '..', 'public', 'slides');
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    console.log('Converting PDF to images...');
    console.log('PDF:', pdfPath);
    console.log('Output:', outputDir);
    
    const options = {
      density: 150,
      saveFilename: 'slide',
      savePath: outputDir,
      format: 'png',
      width: 1200,
      height: 800
    };
    
    const convert = fromPath(pdfPath, options);
    const result = await convert.bulk(-1); // Convert all pages
    
    console.log(`Converted ${result.length} pages to images`);
    
    // Create a JSON file with slide metadata
    const slidesData = {
      title: "Unmasking AI Bias",
      totalSlides: result.length,
      slides: result.map((page, index) => ({
        id: index + 1,
        title: `Slide ${index + 1}`,
        image: `/slides/slide.${index + 1}.png`,
        pageNumber: index + 1
      }))
    };
    
    const jsonPath = path.join(__dirname, '..', 'src', 'data', 'pdfSlides.json');
    fs.writeFileSync(jsonPath, JSON.stringify(slidesData, null, 2));
    
    console.log('Slide metadata saved to:', jsonPath);
    console.log('Conversion complete!');
    
  } catch (error) {
    console.error('Error converting PDF:', error);
    process.exit(1);
  }
}

convertPdfToImages();
