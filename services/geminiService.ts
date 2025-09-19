
import { GoogleGenAI, Modality } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

/**
 * Edits an image based on a text prompt using the Gemini API.
 * @param base64ImageData The base64 encoded image data (without the data URL prefix).
 * @param mimeType The MIME type of the image (e.g., 'image/png').
 * @param prompt The text prompt describing the desired edit.
 * @returns A promise that resolves to the base64 encoded string of the generated image.
 */
export const editImage = async (base64ImageData: string, mimeType: string, prompt: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64ImageData,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });
    
    // The API can return multiple parts, we need to find the image part.
    const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

    if (imagePart && imagePart.inlineData) {
      return imagePart.inlineData.data;
    } else {
      // Check for text response which might indicate an error or refusal
      const textPart = response.candidates?.[0]?.content?.parts?.find(part => part.text);
      if(textPart?.text){
         throw new Error(`API returned text instead of an image: ${textPart.text}`);
      }
      throw new Error("The API did not return an image. The request may have been blocked.");
    }

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error(`Failed to generate image variation. ${error instanceof Error ? error.message : String(error)}`);
  }
};
