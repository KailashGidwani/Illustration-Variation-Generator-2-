
import React, { useState, useCallback, useMemo } from 'react';
import { editImage } from './services/geminiService';

// --- Type Definitions ---
interface GeneratedImage {
  prompt: string;
  imageUrl: string;
}

// --- Icon Components (defined inside App.tsx to reduce file count) ---
const UploadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
  </svg>
);

const PlusIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

const TrashIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.067-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
  </svg>
);

const SparklesIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
  </svg>
);

const Spinner: React.FC = () => (
    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

// --- Helper Function ---
const fileToBase64 = (file: File): Promise<{ data: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const mimeType = result.split(';')[0].split(':')[1];
      const base64Data = result.split(',')[1];
      resolve({ data: base64Data, mimeType });
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};


// --- Main App Component ---
export default function App() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<string[]>(['Make the character a futuristic space explorer']);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) { // 4MB limit for Gemini inline data
        setError("Image size cannot exceed 4MB.");
        return;
      }
      setUploadedFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
      setError(null);
    }
  };

  const handlePromptChange = (index: number, value: string) => {
    const newPrompts = [...prompts];
    newPrompts[index] = value;
    setPrompts(newPrompts);
  };

  const addPrompt = () => {
    setPrompts([...prompts, '']);
  };

  const removePrompt = (index: number) => {
    setPrompts(prompts.filter((_, i) => i !== index));
  };

  const handleGenerateVariations = useCallback(async () => {
    if (!uploadedFile) {
      setError('Please upload an image first.');
      return;
    }

    const nonEmptyPrompts = prompts.filter(p => p.trim() !== '');
    if (nonEmptyPrompts.length === 0) {
      setError('Please provide at least one generation prompt.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setGeneratedImages([]);

    try {
      const { data: base64ImageData, mimeType } = await fileToBase64(uploadedFile);

      const imageGenerationPromises = nonEmptyPrompts.map(async (prompt) => {
        const generatedImageBase64 = await editImage(base64ImageData, mimeType, prompt);
        return {
          prompt,
          imageUrl: `data:image/png;base64,${generatedImageBase64}`,
        };
      });

      const newImages = await Promise.all(imageGenerationPromises);
      setGeneratedImages(newImages);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      console.error(e);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [uploadedFile, prompts]);
  
  const isGenerateDisabled = useMemo(() => isLoading || !uploadedFile, [isLoading, uploadedFile]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
            Illustration Variation Generator
          </h1>
          <p className="mt-3 text-lg text-slate-400 max-w-2xl mx-auto">
            Upload your artwork, describe your desired changes, and let AI generate stunning new versions.
          </p>
        </header>

        {error && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative mb-6 max-w-4xl mx-auto" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* --- Left Column: Controls --- */}
          <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700 flex flex-col gap-6 h-fit">
            <div>
              <h2 className="text-2xl font-semibold mb-1 text-slate-200">1. Upload Your Image</h2>
              <p className="text-slate-400 mb-4 text-sm">Upload a PNG, JPG, or WEBP file. Max size: 4MB.</p>
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="border-2 border-dashed border-slate-600 hover:border-indigo-500 transition-colors rounded-xl p-6 text-center">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Uploaded preview" className="max-h-60 mx-auto rounded-lg object-contain" />
                  ) : (
                    <div className="flex flex-col items-center text-slate-400">
                      <UploadIcon className="w-12 h-12 mb-2" />
                      <span className="font-semibold text-indigo-400">Click to upload</span>
                      <span className="text-sm">or drag and drop</span>
                    </div>
                  )}
                </div>
              </label>
              <input id="file-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleImageUpload} />
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-4 text-slate-200">2. Describe Variations</h2>
              <div className="space-y-3">
                {prompts.map((prompt, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={prompt}
                      onChange={(e) => handlePromptChange(index, e.target.value)}
                      placeholder={`e.g., Change outfit to a red dress`}
                      className="flex-grow bg-slate-900 border border-slate-700 rounded-md py-2 px-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                    />
                    <button onClick={() => removePrompt(index)} className="p-2 text-slate-500 hover:text-red-400 transition-colors" aria-label="Remove prompt">
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={addPrompt} className="mt-4 flex items-center gap-2 text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
                <PlusIcon className="w-5 h-5" />
                Add Another Variation Prompt
              </button>
            </div>
            
            <button
              onClick={handleGenerateVariations}
              disabled={isGenerateDisabled}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-500 transition-all duration-300 disabled:bg-slate-700 disabled:cursor-not-allowed disabled:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/50 transform active:scale-95"
            >
              {isLoading ? (
                <>
                  <Spinner />
                  Generating...
                </>
              ) : (
                <>
                  <SparklesIcon className="w-6 h-6" />
                  Generate Variations
                </>
              )}
            </button>
          </div>

          {/* --- Right Column: Results --- */}
          <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
            <h2 className="text-2xl font-semibold mb-4 text-slate-200">3. Generated Results</h2>
            {isLoading && generatedImages.length === 0 && (
                <div className="flex flex-col items-center justify-center text-center text-slate-400 h-full min-h-[300px]">
                    <Spinner />
                    <p className="mt-4 text-lg">Generating your illustrations...</p>
                    <p className="text-sm">This may take a moment.</p>
                </div>
            )}
            {!isLoading && generatedImages.length === 0 && (
              <div className="flex flex-col items-center justify-center text-center text-slate-500 h-full min-h-[300px] border-2 border-dashed border-slate-700 rounded-xl p-4">
                <SparklesIcon className="w-16 h-16 mb-4" />
                <p className="text-lg font-medium">Your generated images will appear here.</p>
              </div>
            )}
            <div className="grid grid-cols-1 gap-6">
              {generatedImages.map((img, index) => (
                <div key={index} className="bg-slate-900 p-4 rounded-lg border border-slate-700 animate-fade-in">
                  <img src={img.imageUrl} alt={`Generated variation for: ${img.prompt}`} className="w-full h-auto rounded-md object-cover" />
                  <p className="text-sm text-slate-400 mt-3 italic">
                    <strong>Prompt:</strong> {img.prompt}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
