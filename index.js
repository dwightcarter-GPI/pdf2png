import { strict as assert } from "assert";
import Canvas from "canvas";
import fs from "fs";
import axios from "axios";
import { PDFDocument } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import path from "path";

class NodeCanvasFactory {
  create(width, height) {
    assert(width > 0 && height > 0, "Invalid canvas size");
    const canvas = Canvas.createCanvas(width, height);
    const context = canvas.getContext("2d");
    return {
      canvas,
      context,
    };
  }

  reset(canvasAndContext, width, height) {
    assert(canvasAndContext.canvas, "Canvas is not specified");
    assert(width > 0 && height > 0, "Invalid canvas size");
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext) {
    assert(canvasAndContext.canvas, "Canvas is not specified");
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

const CMAP_URL = "../../../node_modules/pdfjs-dist/cmaps/";
const CMAP_PACKED = true;
const STANDARD_FONT_DATA_URL = "../../../node_modules/pdfjs-dist/standard_fonts/";
const canvasFactory = new NodeCanvasFactory();

// const pdfUrl = "http://127.0.0.1:1000/report/51"; // URL to fetch PDF data

(async (inputPDF) => {
  try {
    let data;

    // Option 1: Fetched PDF

    // const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
    // data = new Uint8Array(response.data);

    
    // Option 2: Use local PDF
    const inputPdfPath = path.resolve("test_pdf.pdf");
    data = new Uint8Array(fs.readFileSync(inputPdfPath));
    

    const pageWidth = 300;
    const pageHeight = 300;

    // Load the PDF document
    const loadingTask = getDocument({
      data,
      cMapUrl: CMAP_URL,
      cMapPacked: CMAP_PACKED,
      standardFontDataUrl: STANDARD_FONT_DATA_URL,
      canvasFactory,
    });

    const pdfDocument = await loadingTask.promise;
    console.log("# PDF document loaded. Total pages:", pdfDocument.numPages);

    // Create a new PDF document
    const newPdfDoc = await PDFDocument.create();

    // Define the output directory and file names
    const outputDir = "output"; 
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    const pdfOutputPath = path.join(outputDir, "output.pdf");

    // Loop through each page of the PDF
    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);

      const viewport = page.getViewport({ scale: 1.0 });

      // Calculate the scaling factor to fit the page into 300x300
      const scale = Math.min(pageWidth / viewport.width, pageHeight / viewport.height);
      const scaledViewport = page.getViewport({ scale });

      const canvasAndContext = canvasFactory.create(pageWidth, pageHeight);
      const renderContext = {
        canvasContext: canvasAndContext.context,
        viewport: scaledViewport,
      };

      console.log(`Rendering page ${pageNum}...`);

      const renderTask = page.render(renderContext);
      await renderTask.promise;

      // Convert the canvas to a PNG buffer
      const image = canvasAndContext.canvas.toBuffer();
      const pngOutputPath = path.join(outputDir, `output_page_${pageNum}.png`);

      // Save the PNG image
      fs.writeFileSync(pngOutputPath, image);
      console.log(`Finished saving page ${pageNum} as PNG: ${pngOutputPath}`);

      const pngImage = await newPdfDoc.embedPng(image);

      // Add a new page to the new PDF and add image to the page
      const newPage = newPdfDoc.addPage([pageWidth, pageHeight]);
      newPage.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      });

      page.cleanup();
      canvasFactory.destroy(canvasAndContext);
    }

    const pdfBytes = await newPdfDoc.save();

    // Save the new PDF document
    // fs.writeFileSync(pdfOutputPath, pdfBytes);
    
    console.log(`All pages processed successfully. New PDF saved as ${pdfOutputPath}.`);
  } catch (error) {
    console.error("Error processing PDF:", error);
  }
})();
