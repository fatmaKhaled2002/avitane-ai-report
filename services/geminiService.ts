
import { GoogleGenAI, Type } from "@google/genai";
import { ProcessedDocument, ReportData } from "../types";

// Declare mammoth for TypeScript (loaded via global script in index.html)
declare const mammoth: any;

const compressImage = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000;
        const MAX_HEIGHT = 1400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.75); 
        resolve(dataUrl.split(',')[1]);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

type GeminiPart = { inlineData: { data: string; mimeType: string } } | { text: string };

const fileToGenerativePart = async (file: File): Promise<GeminiPart> => {
  try {
    if (file.type === 'application/pdf') {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = (reader.result as string).split(',')[1];
                resolve({ inlineData: { data: base64, mimeType: file.type } });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const arrayBuffer = e.target?.result as ArrayBuffer;
                try {
                    const result = await mammoth.extractRawText({ arrayBuffer });
                    resolve({ text: `Word Content (${file.name}):\n${result.value}` });
                } catch (err) { reject(err); }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    const base64Data = await compressImage(file);
    return { inlineData: { data: base64Data, mimeType: 'image/jpeg' } };
  } catch (error) {
    console.error("Processing error:", file.name, error);
    throw error;
  }
};

const BATCH_SIZE = 10;

export const analyzeDocumentsMetadata = async (
    files: File[], 
    onProgress?: (processed: number, total: number) => void
): Promise<Omit<ProcessedDocument, 'file' | 'previewUrl'>[]> => {
  const allResults: any[] = [];
  
  // Re-initialize Gemini client to pick up latest API key
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const chunk = files.slice(i, i + BATCH_SIZE);
    const fileParts = await Promise.all(chunk.map(fileToGenerativePart));
    
    const prompt = `
      You are a Medical Registrar. Analyze these ${chunk.length} records.
      1. DATE: Extract exactly as YYYY-MM-DD.
      2. TYPE: LAB, IMAGING, PRESCRIPTION, NOTE, or OTHER.
      3. SUMMARY: 1-sentence clinical finding.
      4. DUPLICATE: Mark true if identical content.
    `;

    const responseSchema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING },
          type: { type: Type.STRING },
          summary: { type: Type.STRING },
          isDuplicate: { type: Type.BOOLEAN }
        },
        required: ['type', 'summary', 'isDuplicate']
      }
    };

    // Correctly use contents: { parts: [...] } for multi-part input
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: prompt }, ...fileParts] },
      config: { responseMimeType: "application/json", responseSchema: responseSchema }
    });

    // Directly access .text property
    const batchData = JSON.parse(response.text || "[]");
    
    batchData.forEach((item: any) => {
      allResults.push({
        id: Math.random().toString(36).substring(7),
        date: item.date || null,
        type: item.type,
        summary: item.summary,
        isDuplicate: item.isDuplicate
      });
    });

    if (onProgress) onProgress(Math.min(i + BATCH_SIZE, files.length), files.length);
  }

  return allResults;
};

export const generateMedicalReport = async (documents: ProcessedDocument[]): Promise<ReportData> => {
  // Re-initialize Gemini client to pick up latest API key
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const activeDocs = documents
    .filter(d => !d.isDuplicate || d.type === 'IMAGING')
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const timelineText = activeDocs.map(d => 
    `Date: ${d.date || 'Unknown'} | Type: ${d.type} | Finding: ${d.summary}`
  ).join('\n');

  const prompt = `
    Synthesize this medical timeline:
    ${timelineText}
    
    Return JSON with: history, summary, prognosis.
  `;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      history: { type: Type.STRING },
      summary: { type: Type.STRING },
      prognosis: { type: Type.STRING },
    },
    required: ['history', 'summary', 'prognosis']
  };

  // Correctly use contents: string for simple text generation
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: responseSchema }
  });

  // Directly access .text property
  return JSON.parse(response.text || "{}") as ReportData;
};
