'use client';

import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UploadCloud, 
  Image as ImageIcon, 
  Sparkles, 
  Loader2, 
  ArrowRight, 
  Download, 
  RefreshCw,
  AlertCircle,
  X,
  CheckCircle2
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import Image from 'next/image';

// Utility to compress image before sending to API
const processImage = (file: File): Promise<{ base64: string; mimeType: string; url: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIMENSION = 2048; // Max dimension for Gemini API to keep payload reasonable
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIMENSION) {
            height *= MAX_DIMENSION / width;
            width = MAX_DIMENSION;
          }
        } else {
          if (height > MAX_DIMENSION) {
            width *= MAX_DIMENSION / height;
            height = MAX_DIMENSION;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Use jpeg for compression unless it's a png (to preserve transparency)
        const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const quality = mimeType === 'image/jpeg' ? 0.85 : 1;
        const dataUrl = canvas.toDataURL(mimeType, quality);
        const base64 = dataUrl.split(',')[1];
        
        resolve({ base64, mimeType, url: dataUrl });
      };
      img.onerror = () => reject(new Error('Failed to load image for processing.'));
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
  });
};

export default function PhotoEditor() {
  const [originalImage, setOriginalImage] = useState<{ url: string; base64: string; mimeType: string } | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setError(null);
      setIsCompressing(true);
      try {
        const processed = await processImage(file);
        setOriginalImage(processed);
        setEditedImage(null);
        setPrompt(''); // Clear previous prompt on new image
      } catch (err: any) {
        setError(err.message || 'Failed to process image.');
      } finally {
        setIsCompressing(false);
      }
    }
  }, []);

  const onDropRejected = useCallback((fileRejections: any[]) => {
    const rejection = fileRejections[0];
    if (rejection.errors[0].code === 'file-too-large') {
      setError('File is too large. Please upload an image under 10MB.');
    } else {
      setError(rejection.errors[0].message || 'Invalid file type.');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: {
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png'],
      'image/webp': ['.webp']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: isProcessing || isCompressing
  });

  const handleEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!originalImage || !prompt.trim()) return;

    setIsProcessing(true);
    setError(null);

    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('Gemini API key is not configured. Please add it to your environment variables.');
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: originalImage.base64,
                mimeType: originalImage.mimeType,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      });

      let foundImage = false;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const base64EncodeString = part.inlineData.data;
          const imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${base64EncodeString}`;
          setEditedImage(imageUrl);
          foundImage = true;
          break;
        }
      }

      if (!foundImage) {
        throw new Error('No image was returned by the AI. Please try a different prompt.');
      }

    } catch (err: any) {
      console.error('Error editing image:', err);
      setError(err.message || 'Failed to edit image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setPrompt(suggestion);
  };

  const resetEditor = () => {
    if (isProcessing) return;
    setOriginalImage(null);
    setEditedImage(null);
    setPrompt('');
    setError(null);
  };

  const downloadImage = () => {
    if (!editedImage) return;
    const a = document.createElement('a');
    a.href = editedImage;
    a.download = `edited-product-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4 md:p-8 flex flex-col items-center justify-center min-h-[80vh]">
      
      <div className="text-center mb-10 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-400 mb-2 shadow-sm"
        >
          <Sparkles className="w-3 h-3 text-emerald-400" />
          <span>Powered by Gemini 2.5 Flash Image</span>
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-4xl md:text-6xl font-medium tracking-tight text-zinc-100"
        >
          Product Photo Editor
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-zinc-400 text-lg max-w-2xl mx-auto"
        >
          Upload a product photo and use text instructions to remove backgrounds, add filters, or clean up details instantly.
        </motion.p>
      </div>

      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl flex items-start gap-3 mb-8 max-w-3xl mx-auto w-full shadow-lg backdrop-blur-md z-50"
          >
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm leading-relaxed">{error}</div>
            <button 
              onClick={() => setError(null)} 
              className="text-red-400 hover:text-red-300 transition-colors p-1 rounded-md hover:bg-red-500/10"
              aria-label="Dismiss error"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {!originalImage ? (
          <motion.div
            key="upload"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4, type: 'spring' }}
            className="w-full max-w-3xl"
          >
            <div 
              {...getRootProps()} 
              className={`
                glass-panel rounded-3xl p-12 text-center transition-all duration-300
                border-2 border-dashed relative overflow-hidden group
                ${isDragActive ? 'border-emerald-500/50 bg-emerald-500/5 scale-[1.02]' : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/30 cursor-pointer'}
                ${isCompressing ? 'opacity-50 pointer-events-none' : ''}
              `}
            >
              <input {...getInputProps()} />
              
              {/* Hover gradient effect */}
              <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/0 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

              <div className="flex flex-col items-center justify-center gap-6 relative z-10">
                <div className={`w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800 transition-transform duration-500 ${isDragActive ? 'scale-110 border-emerald-500/30' : 'group-hover:scale-110'}`}>
                  {isCompressing ? (
                    <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                  ) : (
                    <UploadCloud className={`w-8 h-8 transition-colors duration-300 ${isDragActive ? 'text-emerald-400' : 'text-zinc-400 group-hover:text-zinc-300'}`} />
                  )}
                </div>
                <div>
                  <p className="text-xl font-medium text-zinc-200 mb-2">
                    {isCompressing ? 'Processing image...' : isDragActive ? 'Drop your photo here' : 'Drag & drop a product photo'}
                  </p>
                  <p className="text-sm text-zinc-500">
                    {isCompressing ? 'Optimizing for AI...' : 'or click to browse from your computer (max 10MB)'}
                  </p>
                </div>
                <div className="flex gap-4 text-xs font-mono text-zinc-600 mt-4">
                  <span className="bg-zinc-900/50 px-2 py-1 rounded-md border border-zinc-800/50">JPEG</span>
                  <span className="bg-zinc-900/50 px-2 py-1 rounded-md border border-zinc-800/50">PNG</span>
                  <span className="bg-zinc-900/50 px-2 py-1 rounded-md border border-zinc-800/50">WEBP</span>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="editor"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full space-y-8"
          >
            <div className="flex justify-between items-center mb-2">
              <button 
                onClick={resetEditor}
                disabled={isProcessing}
                className="text-sm text-zinc-400 hover:text-zinc-200 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-zinc-900/50 px-3 py-1.5 rounded-full border border-zinc-800 hover:bg-zinc-800"
              >
                <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} /> 
                {isProcessing ? 'Processing...' : 'Start Over'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
              {/* Original Image */}
              <div className="space-y-3 flex flex-col">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" /> Original
                  </h3>
                </div>
                <div className="relative aspect-square rounded-2xl overflow-hidden glass-panel group flex-1 bg-zinc-900/30">
                  <Image 
                    src={originalImage.url} 
                    alt="Original product" 
                    fill 
                    className="object-contain p-4 transition-transform duration-700 group-hover:scale-[1.02]"
                    referrerPolicy="no-referrer"
                    unoptimized
                  />
                  
                  {/* Scanning Animation Overlay during processing */}
                  <AnimatePresence>
                    {isProcessing && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-10 pointer-events-none overflow-hidden rounded-2xl"
                      >
                        <motion.div
                          className="w-full h-1 bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,1)] absolute left-0"
                          animate={{ top: ['0%', '100%', '0%'] }}
                          transition={{ duration: 2.5, ease: 'linear', repeat: Infinity }}
                        />
                        <div className="absolute inset-0 bg-emerald-500/10 mix-blend-overlay animate-pulse"></div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Edited Image or Loading State */}
              <div className="space-y-3 flex flex-col">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> Result
                  </h3>
                  {editedImage && !isProcessing && (
                    <button 
                      onClick={downloadImage}
                      className="text-xs flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 transition-colors bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 hover:bg-emerald-500/20"
                    >
                      <Download className="w-3.5 h-3.5" /> Download
                    </button>
                  )}
                </div>
                <div className="relative aspect-square rounded-2xl overflow-hidden glass-panel flex items-center justify-center flex-1 bg-zinc-900/30">
                  {isProcessing ? (
                    <div className="flex flex-col items-center gap-5 text-zinc-400 w-full max-w-[200px]">
                      <div className="relative">
                        <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl animate-pulse"></div>
                        <Loader2 className="w-10 h-10 animate-spin text-emerald-500 relative z-10" />
                      </div>
                      <div className="space-y-2 w-full text-center">
                        <p className="text-sm font-mono text-emerald-400">Applying AI magic...</p>
                        <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-emerald-500"
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 15, ease: "circOut" }} // Fake progress
                          />
                        </div>
                      </div>
                    </div>
                  ) : editedImage ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5 }}
                      className="w-full h-full relative group"
                    >
                      <Image 
                        src={editedImage} 
                        alt="Edited product" 
                        fill 
                        className="object-contain p-4 transition-transform duration-700 group-hover:scale-[1.02]"
                        referrerPolicy="no-referrer"
                        unoptimized
                      />
                      <div className="absolute top-4 right-4 bg-zinc-900/80 backdrop-blur-md border border-zinc-700/50 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-xl">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      </div>
                    </motion.div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 text-zinc-600">
                      <div className="w-16 h-16 rounded-full bg-zinc-900/50 flex items-center justify-center border border-zinc-800/50">
                        <ImageIcon className="w-8 h-8 opacity-50" />
                      </div>
                      <p className="text-sm font-medium">Awaiting instructions</p>
                      <p className="text-xs text-zinc-500 max-w-[200px] text-center">Type a prompt below to start editing your photo</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Prompt Input Area */}
            <div className="max-w-3xl mx-auto w-full mt-12">
              <form onSubmit={handleEdit} className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-emerald-500/20 rounded-2xl blur-md opacity-0 group-hover:opacity-100 transition duration-500"></div>
                <div className="relative flex items-center bg-zinc-900 border border-zinc-700/50 rounded-2xl overflow-hidden shadow-2xl focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/50 transition-all">
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., Remove the background, add a soft shadow, make it look cinematic..."
                    className="w-full bg-transparent text-zinc-100 px-6 py-5 outline-none placeholder:text-zinc-500 text-lg"
                    disabled={isProcessing}
                    aria-label="Image editing prompt"
                  />
                  
                  {prompt && !isProcessing && (
                    <button
                      type="button"
                      onClick={() => setPrompt('')}
                      className="p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
                      aria-label="Clear prompt"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={!prompt.trim() || isProcessing}
                    className="mr-3 ml-1 p-3 bg-zinc-100 text-zinc-900 rounded-xl hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center shadow-sm"
                    aria-label="Generate edit"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <ArrowRight className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </form>
              
              <div className="flex flex-wrap gap-2 mt-6 justify-center">
                {[
                  'Remove background', 
                  'Add a retro filter', 
                  'Make it cinematic', 
                  'Place it on a marble table',
                  'Enhance lighting and contrast'
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    disabled={isProcessing}
                    className="text-xs px-4 py-2 rounded-full bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 hover:border-zinc-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
