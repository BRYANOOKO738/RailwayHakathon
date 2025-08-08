import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Play, Pause, FileAudio, FileVideo, Languages, Loader2, CheckCircle, AlertCircle, Copy, Check, FileText, PenTool, BookOpen, Download, Mic, Volume2 } from 'lucide-react';

const AudioTranscriberTool = () => {
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState(''); // 'audio' or 'video'
  const [processing, setProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [copiedText, setCopiedText] = useState('');
  
  // Content generation states
  const [generatedContent, setGeneratedContent] = useState({});
  const [contentLoading, setContentLoading] = useState({});
  const [activeTab, setActiveTab] = useState('transcript');
  
  const mediaRef = useRef(null);
  const audioContextRef = useRef(null);

  // Get API keys from environment variables
  const LEMONFOX_API_KEY = import.meta.env.VITE_LEMONFOX_API_KEY || '';
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

  // API Configuration
  const LEMONFOX_API_URL = 'https://api.lemonfox.ai/v1';
  const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';

  // Supported languages for transcription b
  const supportedLanguages = {
    'auto': 'Auto-detect',
    'english': 'English',
    'swahili': 'Kiswahili',
    'spanish': 'Spanish',
    'french': 'French',
    'german': 'German',
    'italian': 'Italian',
    'portuguese': 'Portuguese',
    'dutch': 'Dutch',
    'russian': 'Russian',
    'chinese': 'Chinese',
    'japanese': 'Japanese',
    'korean': 'Korean',
    'arabic': 'Arabic',
    'hindi': 'Hindi',
    'urdu': 'Urdu',
    'turkish': 'Turkish',
    'greek': 'Greek',
    'hebrew': 'Hebrew',
    'thai': 'Thai',
    'vietnamese': 'Vietnamese'
  };

  // Translation target languages
  const targetLanguages = {
    // Global languages
    'english': 'English',
    'swahili': 'Kiswahili',
    'spanish': 'Spanish',
    'french': 'French',
    'german': 'German',
    'italian': 'Italian',
    'portuguese': 'Portuguese',
    'dutch': 'Dutch',
    'russian': 'Russian',
    'chinese': 'Chinese',
    'japanese': 'Japanese',
    'korean': 'Korean',
    'arabic': 'Arabic',
    'hindi': 'Hindi',
    'urdu': 'Urdu',
    'turkish': 'Turkish',
  
    // Kenyan indigenous languages
    'kikuyu': 'Kikuyu',
    'luo': 'Luo',
    'kamba': 'Kamba',
    'luhya': 'Luhya',
    'kisii': 'Kisii',
    'kalenjin': 'Kalenjin',
    'maasai': 'Maasai',
    'meru': 'Meru',
    'embu': 'Embu',
    'samburu': 'Samburu',
    'pokot': 'Pokot',
    'turkana': 'Turkana',
    'rendille': 'Rendille',
    'taita': 'Taita',
    'somali': 'Somali (Kenyan dialect)'
  };
  

  // Check if API keys are available
  useEffect(() => {
    if (!LEMONFOX_API_KEY || !GEMINI_API_KEY) {
      setError('API keys not found. Please set REACT_APP_LEMONFOX_API_KEY and REACT_APP_GEMINI_API_KEY in your .env file.');
    }
  }, [LEMONFOX_API_KEY, GEMINI_API_KEY]);

  // Copy text functionality
  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(type);
      setTimeout(() => setCopiedText(''), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  // Utility function to create audio context
  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContextRef.current;
  };

  // Extract audio from video using Web APIs
  const extractAudioFromVideo = async (videoFile) => {
    try {
      setCurrentStep('Extracting audio from video...');
      setProgress(25);

      const videoElement = document.createElement('video');
      videoElement.src = URL.createObjectURL(videoFile);
      
      return new Promise((resolve, reject) => {
        videoElement.onloadedmetadata = async () => {
          try {
            // Create MediaRecorder to capture audio
            const stream = videoElement.captureStream ? videoElement.captureStream() : videoElement.mozCaptureStream();
            const audioStream = new MediaStream(stream.getAudioTracks());
            
            const mediaRecorder = new MediaRecorder(audioStream, {
              mimeType: 'audio/webm;codecs=opus'
            });
            
            const audioChunks = [];
            
            mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0) {
                audioChunks.push(event.data);
              }
            };
            
            mediaRecorder.onstop = () => {
              const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
              resolve({
                audioBlob,
                duration: videoElement.duration
              });
            };
            
            mediaRecorder.onerror = reject;
            
            videoElement.play();
            mediaRecorder.start();
            
            // Stop recording when video ends
            videoElement.onended = () => {
              mediaRecorder.stop();
              videoElement.pause();
            };
            
            // Fallback stop after duration
            setTimeout(() => {
              if (mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
                videoElement.pause();
              }
            }, videoElement.duration * 1000 + 1000);
            
          } catch (err) {
            reject(err);
          }
        };
        
        videoElement.onerror = reject;
      });
    } catch (error) {
      throw new Error(`Audio extraction failed: ${error.message}`);
    }
  };

  // Transcribe audio using LemonFox API
  const transcribeAudio = async (audioBlob) => {
    try {
      setCurrentStep(`Transcribing audio${sourceLanguage !== 'auto' ? ` from ${supportedLanguages[sourceLanguage]}` : ''}...`);
      setProgress(70);

      if (!LEMONFOX_API_KEY) {
        throw new Error('LemonFox API key not found in environment variables');
      }

      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      if (sourceLanguage !== 'auto') {
        formData.append('language', sourceLanguage);
      }
      formData.append('response_format', 'json');

      const response = await fetch(`${LEMONFOX_API_URL}/audio/transcriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LEMONFOX_API_KEY}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Transcription failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      const transcriptText = result.text || result.transcript || result;
      
      if (!transcriptText || !transcriptText.trim()) {
        throw new Error('No transcript text received');
      }

      return transcriptText;
    } catch (error) {
      throw new Error(`Transcription failed: ${error.message}`);
    }
  };

  // Main processing function
  const processMedia = async () => {
    if (!mediaFile) {
      setError('Please select an audio or video file');
      return;
    }

    if (!LEMONFOX_API_KEY) {
      setError('LemonFox API key not found in environment variables');
      return;
    }

    setProcessing(true);
    setError('');
    setProgress(0);
    setTranscript('');
    setGeneratedContent({});
    setActiveTab('transcript');

    try {
      let audioBlob;
      
      if (mediaType === 'video') {
        // Extract audio from video
        const { audioBlob: extractedAudio } = await extractAudioFromVideo(mediaFile);
        audioBlob = extractedAudio;
      } else {
        // Use audio file directly
        setCurrentStep('Preparing audio file...');
        setProgress(25);
        audioBlob = mediaFile;
      }

      // Transcribe audio
      const transcriptText = await transcribeAudio(audioBlob);

      setProgress(100);
      setCurrentStep('Transcription completed!');
      setTranscript(transcriptText);

    } catch (err) {
      setError(err.message);
      console.error('Processing error:', err);
    } finally {
      setProcessing(false);
    }
  };

  // Generate content using Gemini API
  const generateContent = async (type, targetLang = null) => {
    if (!transcript) {
      setError('No transcript available. Please transcribe audio first.');
      return;
    }

    if (!GEMINI_API_KEY) {
      setError('Google Gemini API key not found in environment variables');
      return;
    }

    setContentLoading(prev => ({ ...prev, [type]: true }));
    
    try {
        let prompt = '';
      
        switch (type) {
          case 'translate':
            if (!targetLang) {
              setError('Please select a target language for translation');
              return;
            }
      
            prompt = `
      You are an expert professional translator with native-level fluency in both English and ${targetLanguages[targetLang]}.
      
      Your task is to accurately translate the following transcript into **natural, fluent, and context-aware** ${targetLanguages[targetLang]}. The translation must preserve:
      - The original **meaning, tone, and intent**
      - **Cultural nuances** and idiomatic expressions
      - Any emotional or formal elements present
      
      Here is the original transcript:
      """
      ${transcript}
      """
      
      Guidelines:
      - Avoid literal or word-for-word translation
      - Prioritize natural phrasing over direct conversion
      - Maintain paragraph structure
      - Format the output cleanly with readable spacing
      
      Respond with **only** the translated content, in clean ${targetLanguages[targetLang]}, with no extra commentary or explanations.
      `;
            break;
      
          case 'summarize':
            prompt = `
      You are an expert content summarizer. Your job is to create a concise, clear, and well-organized summary of the following transcript.
      
      Requirements:
      - Provide a **brief headline/title** for the summary
      - Structure your response into:
        1. **Main Theme**
        2. **Key Points** (as bullet points)
        3. **Notable Insights or Details**
        4. **Conclusion / Final Takeaways**
      
      Here is the transcript to summarize:
      """
      ${transcript}
      """
      
      Ensure the summary is professional, easy to read, and captures the full context.
      Respond with **only** the summary, properly structured.
      `;
            break;
      
            case 'article':
                prompt = `
              You are a professional content writer and editor. Transform the following transcript into a **high-quality, publication-ready article**, suitable for rendering in a modern HTML editor or Markdown-compatible viewer.
              
              📝 **Requirements**:
              - Write an **SEO-optimized, engaging title**
              - Use **semantic HTML structure**: <h1>, <h2>, <p>, <ul>, etc.
              - Start with a **compelling introduction** that hooks readers
              - Organize content into **sections** with clear subheadings
              - Maintain a smooth, logical flow between ideas
              - End with a **strong, memorable conclusion**
              - Write in a **professional, concise, and engaging tone**
              - Ensure content is **clean and valid HTML** without extra wrappers or noise
              - Target word count: 800–1200 words
              
              📄 **Original transcript**:
              """
              ${transcript}
              """
              
              🎯 Output:
              Respond with only the final article wrapped in **valid HTML**. The output must:
              - Use proper tags (<h1>, <h2>, <p>, etc.)
              - Avoid styling or inline CSS
              - Be ready to render inside an HTML viewer or Prism.js-powered editor.
              
              Do **not** include explanations, notes, or markdown. Just clean HTML.
              `;
                break;
              
        default:
          throw new Error('Invalid content type');
      }

      const response = await fetch(`${GEMINI_API_URL}/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: type === 'article' ? 0.7 : 0.3,
            maxOutputTokens: type === 'article' ? 4096 : 2048
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Content generation failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        const generatedText = data.candidates[0].content.parts[0].text.trim();
        setGeneratedContent(prev => ({
          ...prev,
          [type]: generatedText
        }));
        setActiveTab(type);
      } else {
        throw new Error('Invalid response format from Gemini API');
      }
    } catch (err) {
      setError(`Content generation failed: ${err.message}`);
      console.error('Content generation error:', err);
    } finally {
      setContentLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  // Handle media file selection
  const handleMediaUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setMediaFile(file);
      setMediaUrl(URL.createObjectURL(file));
      setMediaType(file.type.startsWith('video/') ? 'video' : 'audio');
      setTranscript('');
      setGeneratedContent({});
      setError('');
      setActiveTab('transcript');
    }
  };

  // Download content as text file
  const downloadContent = (content, filename) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Toggle media playback
  const togglePlayback = () => {
    if (mediaRef.current) {
      if (isPlaying) {
        mediaRef.current.pause();
      } else {
        mediaRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-4" style={{borderRadius:"10px"}}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center justify-center gap-3">
            <Mic className="w-10 h-10 text-purple-400" />
            AI Audio Transcriber & Content Generator
          </h1>
          <p className="text-purple-200">Transcribe audio/video, then translate, summarize, or create articles with AI</p>
        </div>

        {/* Language Selection */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-6 border border-white/20">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Languages className="w-5 h-5" />
            Transcription Language
          </h2>
          <div className="max-w-md">
            <label className="block text-sm font-medium text-purple-200 mb-2">Source Language</label>
            <select
              value={sourceLanguage}
              onChange={(e) => setSourceLanguage(e.target.value)}
              className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              {Object.entries(supportedLanguages).map(([code, name]) => (
                <option key={code} value={code} className="bg-gray-800 text-white">
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        

        {/* Media Upload */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-6 border border-white/20">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload Audio or Video
          </h2>
          
          <div className="border-2 border-dashed border-white/30 rounded-lg p-8 text-center">
            <input
              type="file"
              accept="audio/*,video/*"
              onChange={handleMediaUpload}
              className="hidden"
              id="media-upload"
            />
            <label htmlFor="media-upload" className="cursor-pointer">
              <div className="flex justify-center mb-4">
                {mediaType === 'video' ? (
                  <FileVideo className="w-16 h-16 text-purple-400" />
                ) : (
                  <FileAudio className="w-16 h-16 text-purple-400" />
                )}
              </div>
              <p className="text-white text-lg mb-2">
                {mediaFile ? mediaFile.name : 'Click to select audio or video file'}
              </p>
              <p className="text-purple-200 text-sm">
                Supports MP3, WAV, MP4, MOV, AVI, WebM formats
              </p>
            </label>
          </div>

          {mediaUrl && (
            <div className="mt-6">
              <div className="relative bg-black rounded-lg overflow-hidden">
                {mediaType === 'video' ? (
                  <video
                    ref={mediaRef}
                    src={mediaUrl}
                    className="w-full max-h-96 object-contain"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    controls
                  />
                ) : (
                  <audio
                    ref={mediaRef}
                    src={mediaUrl}
                    className="w-full"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    controls
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Processing Controls */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-6 border border-white/20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Volume2 className="w-5 h-5" />
              Transcription
            </h2>
            <button
              onClick={processMedia}
              disabled={processing || !mediaFile || !LEMONFOX_API_KEY}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg font-medium hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
            >
              {processing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Start Transcription
                </>
              )}
            </button>
          </div>

          {/* Progress */}
          {processing && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm text-purple-200 mb-2">
                  <span>{currentStep}</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-pink-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-4 bg-red-500/20 border border-red-500/30 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-red-300 font-medium">Processing Error</h3>
                <p className="text-red-200 text-sm mt-1">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        {transcript && (
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              Results & Content Generation
            </h2>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 mb-6">
              <button
                onClick={() => setActiveTab('transcript')}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                  activeTab === 'transcript'
                    ? 'bg-purple-500 text-white'
                    : 'bg-white/10 text-purple-200 hover:bg-white/20'
                }`}
              >
                <FileText className="w-4 h-4" />
                Transcript
              </button>

              <div className="flex items-center gap-2">
                <select
                  id="translate-lang"
                  className="px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  defaultValue="english"
                >
                  {Object.entries(targetLanguages).map(([code, name]) => (
                    <option key={code} value={code} className="bg-gray-800 text-white">
                      {name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    const selectElement = document.getElementById('translate-lang');
                    generateContent('translate', selectElement.value);
                  }}
                  disabled={contentLoading.translate}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-teal-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-teal-700 disabled:opacity-50 transition-all duration-200 flex items-center gap-2"
                >
                  {contentLoading.translate ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Languages className="w-4 h-4" />
                  )}
                  Translate
                </button>
              </div>

              <button
                onClick={() => generateContent('summarize')}
                disabled={contentLoading.summarize}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-medium hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 transition-all duration-200 flex items-center gap-2"
              >
                {contentLoading.summarize ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <BookOpen className="w-4 h-4" />
                )}
                Summarize
              </button>

              <button
                onClick={() => generateContent('article')}
                disabled={contentLoading.article}
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg font-medium hover:from-orange-600 hover:to-red-700 disabled:opacity-50 transition-all duration-200 flex items-center gap-2"
              >
                {contentLoading.article ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <PenTool className="w-4 h-4" />
                )}
                Write Article
              </button>
            </div>

            {/* Content Tabs */}
            <div className="space-y-4">
              {/* Transcript Tab */}
              {activeTab === 'transcript' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-medium text-purple-300">Original Transcript</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyToClipboard(transcript, 'transcript')}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors duration-200"
                        title="Copy transcript"
                      >
                        {copiedText === 'transcript' ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-purple-400" />
                        )}
                      </button>
                      <button
                        onClick={() => downloadContent(transcript, 'transcript')}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors duration-200"
                        title="Download transcript"
                      >
                        <Download className="w-4 h-4 text-purple-400" />
                      </button>
                    </div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{transcript}</p>
                  </div>
                </div>
              )}

              {/* Translation Tab */}
              {activeTab === 'translate' && generatedContent.translate && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-medium text-blue-300">Translation</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyToClipboard(generatedContent.translate, 'translation')}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors duration-200"
                        title="Copy translation"
                      >
                        {copiedText === 'translation' ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-blue-400" />
                        )}
                      </button>
                      <button
                        onClick={() => downloadContent(generatedContent.translate, 'translation')}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors duration-200"
                        title="Download translation"
                      >
                        <Download className="w-4 h-4 text-blue-400" />
                      </button>
                    </div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{generatedContent.translate}</p>
                  </div>
                </div>
              )}

              {/* Summary Tab */}
              {activeTab === 'summarize' && generatedContent.summarize && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-medium text-green-300">Summary</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyToClipboard(generatedContent.summarize, 'summary')}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors duration-200"
                        title="Copy summary"
                      >
                        {copiedText === 'summary' ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (                      <Copy className="w-4 h-4 text-green-400" />
                        )}
                      </button>
                      <button
                        onClick={() => downloadContent(generatedContent.summarize, 'summary')}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors duration-200"
                        title="Download summary"
                      >
                        <Download className="w-4 h-4 text-green-400" />
                      </button>
                    </div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <div 
                      className="text-white text-sm leading-relaxed whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{ 
                        __html: generatedContent.summarize.replace(/\n/g, '<br />') 
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Article Tab */}
              {activeTab === 'article' && generatedContent.article && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-medium text-orange-300">Generated Article</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyToClipboard(generatedContent.article, 'article')}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors duration-200"
                        title="Copy article"
                      >
                        {copiedText === 'article' ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-orange-400" />
                        )}
                      </button>
                      <button
                        onClick={() => downloadContent(generatedContent.article, 'article')}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors duration-200"
                        title="Download article"
                      >
                        <Download className="w-4 h-4 text-orange-400" />
                      </button>
                    </div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <div 
                      className="text-white text-sm leading-relaxed whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{ 
                        __html: generatedContent.article.replace(/\n/g, '<br />') 
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Loading State */}
              {(contentLoading.translate || contentLoading.summarize || contentLoading.article) && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioTranscriberTool;