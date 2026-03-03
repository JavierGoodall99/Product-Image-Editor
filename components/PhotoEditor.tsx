'use client';

import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'motion/react';
import { UploadCloud, Image as ImageIcon, Sparkles, Loader2, ArrowRight, Download, RefreshCw } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import Image from 'next/image';

export default function PhotoEditor() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [originalMimeType, setOriginalMimeType] = useState<string | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setOriginalImage(result);
        setOriginalMimeType(file.type);
        setEditedImage(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    maxFiles: 1,
  });

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!originalImage || !prompt.trim() || !originalMimeType) return;

    setIsProcessing(true);
    setError(null);

    try {
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('Gemini API key is not configured.');
      }

      const ai = new GoogleGenAI({ apiKey });
      
      // Extract base64 data without the data URL prefix
      const base64Data = originalImage.split(',')[1];

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: originalMimeType,
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
        throw new Error('No image was returned by the AI.');
      }

    } catch (err: any) {
      console.error('Error editing image:', err);
      setError(err.message || 'Failed to edit image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetEditor = () => {
    setOriginalImage(null);
    setOriginalMimeType(null);
    setEditedImage(null);
    setPrompt('');
    setError(null);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4 md:p-8 flex flex-col items-center justify-center min-h-[80vh]">
      
      <div className="text-center mb-12 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-400 mb-4"
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
                glass-panel rounded-3xl p-12 text-center cursor-pointer transition-all duration-300
                border-2 border-dashed
                ${isDragActive ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/30'}
              `}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center justify-center gap-6">
                <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800">
                  <UploadCloud className="w-8 h-8 text-zinc-400" />
                </div>
                <div>
                  <p className="text-xl font-medium text-zinc-200 mb-2">
                    {isDragActive ? 'Drop your photo here' : 'Drag & drop a product photo'}
                  </p>
                  <p className="text-sm text-zinc-500">
                    or click to browse from your computer
                  </p>
                </div>
                <div className="flex gap-4 text-xs font-mono text-zinc-600 mt-4">
                  <span>JPEG</span>
                  <span>PNG</span>
                  <span>WEBP</span>
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
            <div className="flex justify-between items-center mb-4">
              <button 
                onClick={resetEditor}
                className="text-sm text-zinc-400 hover:text-zinc-200 flex items-center gap-2 transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Start Over
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Original Image */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-mono text-zinc-400 uppercase tracking-wider">Original</h3>
                </div>
                <div className="relative aspect-square rounded-2xl overflow-hidden glass-panel group">
                  <Image 
                    src={originalImage} 
                    alt="Original product" 
                    fill 
                    className="object-contain p-4"
                    referrerPolicy="no-referrer"
                    unoptimized
                  />
                </div>
              </div>

              {/* Edited Image or Loading State */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-mono text-zinc-400 uppercase tracking-wider">Result</h3>
                  {editedImage && (
                    <a 
                      href={editedImage} 
                      download="edited-product.png"
                      className="text-xs flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      <Download className="w-3 h-3" /> Download
                    </a>
                  )}
                </div>
                <div className="relative aspect-square rounded-2xl overflow-hidden glass-panel flex items-center justify-center">
                  {isProcessing ? (
                    <div className="flex flex-col items-center gap-4 text-zinc-400">
                      <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                      <p className="text-sm font-mono animate-pulse">Processing with AI...</p>
                    </div>
                  ) : editedImage ? (
                      <Image 
                        src={editedImage} 
                        alt="Edited product" 
                        fill 
                        className="object-contain p-4"
                        referrerPolicy="no-referrer"
                        unoptimized
                      />
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-zinc-600">
                      <ImageIcon className="w-8 h-8 opacity-50" />
                      <p className="text-sm">Awaiting instructions</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Prompt Input */}
            <div className="max-w-3xl mx-auto w-full mt-12">
              <form onSubmit={handleEdit} className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
                <div className="relative flex items-center bg-zinc-900 border border-zinc-700/50 rounded-2xl overflow-hidden shadow-xl focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/50 transition-all">
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., Remove the background, add a soft shadow, make it look cinematic..."
                    className="w-full bg-transparent text-zinc-100 px-6 py-5 outline-none placeholder:text-zinc-500 text-lg"
                    disabled={isProcessing}
                  />
                  <button
                    type="submit"
                    disabled={!prompt.trim() || isProcessing}
                    className="mr-3 p-3 bg-zinc-100 text-zinc-900 rounded-xl hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <ArrowRight className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </form>
              
              {error && (
                <motion.p 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-400 text-sm mt-4 text-center"
                >
                  {error}
                </motion.p>
              )}
              
              <div className="flex flex-wrap gap-2 mt-6 justify-center">
                {['Remove background', 'Add a retro filter', 'Make it cinematic', 'Place it on a marble table'].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setPrompt(suggestion)}
                    className="text-xs px-3 py-1.5 rounded-full bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
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
