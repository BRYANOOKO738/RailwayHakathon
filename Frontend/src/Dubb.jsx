import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Play, Pause, Download, FileVideo, Volume2, Languages, Loader2, CheckCircle, AlertCircle, Copy, Check } from 'lucide-react';

const VideoDubber = () => {
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [processing, setProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState('swahili');
  const [targetLanguage, setTargetLanguage] = useState('english');
  const [copiedText, setCopiedText] = useState('');
  // n
  const videoRef = useRef(null);
  const audioContextRef = useRef(null);
  const canvasRef = useRef(null);

  const LEMONFOX_API_KEY = import.meta.env.VITE_LEMONFOX_API_KEY ;
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY ;
  

  // API Configuration
  const LEMONFOX_API_URL = 'https://api.lemonfox.ai/v1';
  const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';

  // Supported languages for LemonFox (common ones)
  const supportedLanguages = {
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

  // Available voices for different languages
  const voiceOptions = {
    'english': ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
    'spanish': ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
    'french': ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
    'german': ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
    'default': ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']
  };

  const [selectedVoice, setSelectedVoice] = useState('alloy');

  // Step tracker
  const steps = [
    'Uploading video',
    'Extracting audio',
    'Transcribing audio',
    'Translating text',
    'Generating speech',
    'Syncing audio',
    'Merging final video'
  ];

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
      setProgress(20);

      const videoElement = document.createElement('video');
      videoElement.src = URL.createObjectURL(videoFile);
      
      return new Promise((resolve, reject) => {
        videoElement.onloadedmetadata = async () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
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
      setCurrentStep(`Transcribing audio from ${supportedLanguages[sourceLanguage]}...`);
      setProgress(40);

      if (!LEMONFOX_API_KEY) {
        throw new Error('LemonFox API key not found in environment variables');
      }

      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('language', sourceLanguage);
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
      const transcript = result.text || result.transcript || result;
      
      if (!transcript || !transcript.trim()) {
        throw new Error('No transcript text received');
      }

      return transcript;
    } catch (error) {
      throw new Error(`Transcription failed: ${error.message}`);
    }
  };

  // Translate text using Google Gemini
  const translateText = async (text, sourceLang, targetLang) => {
    try {
      setCurrentStep(`Translating from ${supportedLanguages[sourceLang]} to ${supportedLanguages[targetLang]}...`);
      setProgress(55);

      if (!GEMINI_API_KEY) {
        throw new Error('Google Gemini API key not found in environment variables');
      }

      const prompt = `You are a professional translator specializing in video dubbing.

Translate the following ${supportedLanguages[sourceLang]} speech to ${supportedLanguages[targetLang]}.

IMPORTANT: Keep the translation in the same length and natural for dubbing. Avoid overly long and overly short sentences that would be difficult to lip-sync. Maintain the original meaning while making it sound natural when spoken.

Original ${supportedLanguages[sourceLang]}:
"""
${text}
"""

Provide a high-quality, concise translation optimized for video dubbing in ${supportedLanguages[targetLang]}.`;

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
            temperature: 0.3,
            maxOutputTokens: 2048
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Translation failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text.trim();
      } else {
        throw new Error('Invalid translation response format');
      }
    } catch (error) {
      throw new Error(`Translation failed: ${error.message}`);
    }
  };

  // Generate speech using LemonFox API
  const generateSpeech = async (text, voice = 'alloy') => {
    try {
      setCurrentStep(`Generating ${supportedLanguages[targetLanguage]} speech...`);
      setProgress(70);

      if (!LEMONFOX_API_KEY) {
        throw new Error('LemonFox API key not found in environment variables');
      }

      const response = await fetch(`${LEMONFOX_API_URL}/audio/speech`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LEMONFOX_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: text,
          voice: voice,
          response_format: 'mp3'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Speech generation failed: ${response.status} - ${errorText}`);
      }

      const audioBlob = await response.blob();
      
      if (audioBlob.size === 0) {
        throw new Error('Generated audio is empty');
      }

      return audioBlob;
    } catch (error) {
      throw new Error(`Speech generation failed: ${error.message}`);
    }
  };

  // Merge audio with video using Web APIs
  const mergeAudioWithVideo = async (videoFile, audioBlob, originalDuration) => {
    try {
      setCurrentStep('Merging dubbed audio with video...');
      setProgress(90);

      // Create video element
      const video = document.createElement('video');
      video.src = URL.createObjectURL(videoFile);
      
      // Create audio element  
      const audio = document.createElement('audio');
      audio.src = URL.createObjectURL(audioBlob);

      return new Promise((resolve, reject) => {
        Promise.all([
          new Promise(res => { video.onloadedmetadata = () => res(); }),
          new Promise(res => { audio.onloadedmetadata = () => res(); })
        ]).then(async () => {
          try {
            // Create canvas for video processing
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Create MediaRecorder for output
            const stream = canvas.captureStream(30);
            
            // Add audio track to stream
            const audioContext = getAudioContext();
            const audioSource = audioContext.createMediaElementSource(audio);
            const destination = audioContext.createMediaStreamDestination();
            audioSource.connect(destination);
            
            // Combine video and audio streams
            const audioTrack = destination.stream.getAudioTracks()[0];
            stream.addTrack(audioTrack);

            const mediaRecorder = new MediaRecorder(stream, {
              mimeType: 'video/webm;codecs=vp9,opus'
            });

            const chunks = [];
            mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0) {
                chunks.push(event.data);
              }
            };

            mediaRecorder.onstop = () => {
              const finalBlob = new Blob(chunks, { type: 'video/webm' });
              resolve(finalBlob);
            };

            mediaRecorder.onerror = reject;

            // Start recording
            mediaRecorder.start();
            
            // Sync video and audio playback
            const startTime = Date.now();
            video.play();
            audio.play();

            // Draw video frames to canvas
            const drawFrame = () => {
              if (video.currentTime < video.duration) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                requestAnimationFrame(drawFrame);
              } else {
                // Stop recording when video ends
                setTimeout(() => {
                  mediaRecorder.stop();
                  video.pause();
                  audio.pause();
                }, 500);
              }
            };

            video.onplaying = () => {
              drawFrame();
            };

            // Fallback stop
            setTimeout(() => {
              if (mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
                video.pause();
                audio.pause();
              }
            }, (originalDuration + 2) * 1000);

          } catch (err) {
            reject(err);
          }
        }).catch(reject);
      });
    } catch (error) {
      throw new Error(`Video merging failed: ${error.message}`);
    }
  };

  // Main dubbing process
  const processVideo = async () => {
    if (!videoFile) {
      setError('Please select a video file');
      return;
    }

    if (!LEMONFOX_API_KEY || !GEMINI_API_KEY) {
      setError('API keys not found in environment variables');
      return;
    }

    if (sourceLanguage === targetLanguage) {
      setError('Source and target languages cannot be the same');
      return;
    }

    setProcessing(true);
    setError('');
    setProgress(0);
    setResults(null);

    try {
      // Step 1: Extract audio
      setCurrentStep('Extracting audio from video...');
      const { audioBlob, duration } = await extractAudioFromVideo(videoFile);

      // Step 2: Transcribe audio
      const transcript = await transcribeAudio(audioBlob);

      // Step 3: Translate text
      const translation = await translateText(transcript, sourceLanguage, targetLanguage);

      // Step 4: Generate speech
      const dubbedAudioBlob = await generateSpeech(translation, selectedVoice);

      // Step 5: Merge audio with video
      const finalVideoBlob = await mergeAudioWithVideo(videoFile, dubbedAudioBlob, duration);

      setProgress(100);
      setCurrentStep('Video dubbing completed!');

      // Set results
      setResults({
        originalTranscript: transcript,
        translation: translation,
        dubbedVideoBlob: finalVideoBlob,
        dubbedVideoUrl: URL.createObjectURL(finalVideoBlob),
        originalDuration: duration,
        sourceLanguage: supportedLanguages[sourceLanguage],
        targetLanguage: supportedLanguages[targetLanguage]
      });

    } catch (err) {
      setError(err.message);
      console.error('Dubbing error:', err);
    } finally {
      setProcessing(false);
    }
  };

  // Handle video file selection
  const handleVideoUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
      setResults(null);
      setError('');
    }
  };

  // Download final video
  const downloadVideo = () => {
    if (results?.dubbedVideoBlob) {
      const a = document.createElement('a');
      a.href = results.dubbedVideoUrl;
      a.download = `dubbed_video_${sourceLanguage}_to_${targetLanguage}_${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Toggle video playback
  const togglePlayback = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center justify-center gap-3">
            <FileVideo className="w-10 h-10 text-blue-400" />
            AI Video Dubber
          </h1>
          <p className="text-blue-200">Transform videos between multiple languages with AI-powered dubbing</p>
        </div>

        {/* Language Selection */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-6 border border-white/20">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Languages className="w-5 h-5" />
            Language Configuration
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-blue-200 mb-2">Source Language</label>
              <select
                value={sourceLanguage}
                onChange={(e) => setSourceLanguage(e.target.value)}
                className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {Object.entries(supportedLanguages).map(([code, name]) => (
                  <option key={code} value={code} className="bg-gray-800 text-white">
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-200 mb-2">Target Language</label>
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {Object.entries(supportedLanguages).map(([code, name]) => (
                  <option key={code} value={code} className="bg-gray-800 text-white">
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-200 mb-2">Voice</label>
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="w-full px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {(voiceOptions[targetLanguage] || voiceOptions.default).map((voice) => (
                  <option key={voice} value={voice} className="bg-gray-800 text-white">
                    {voice.charAt(0).toUpperCase() + voice.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        
        

        {/* Video Upload */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-6 border border-white/20">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload Video
          </h2>
          
          <div className="border-2 border-dashed border-white/30 rounded-lg p-8 text-center">
            <input
              type="file"
              accept="video/*"
              onChange={handleVideoUpload}
              className="hidden"
              id="video-upload"
            />
            <label htmlFor="video-upload" className="cursor-pointer">
              <FileVideo className="w-16 h-16 text-blue-400 mx-auto mb-4" />
              <p className="text-white text-lg mb-2">
                {videoFile ? videoFile.name : 'Click to select video file'}
              </p>
              <p className="text-blue-200 text-sm">
                Supports MP4, MOV, AVI, WebM formats
              </p>
            </label>
          </div>

          {videoUrl && (
            <div className="mt-6">
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full max-h-96 object-contain"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  controls
                />
              </div>
            </div>
          )}
        </div>

        {/* Processing Controls */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 mb-6 border border-white/20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Volume2 className="w-5 h-5" />
              Video Dubbing
            </h2>
            <button
              onClick={processVideo}
              disabled={processing || !videoFile || !LEMONFOX_API_KEY || !GEMINI_API_KEY || sourceLanguage === targetLanguage}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
            >
              {processing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Start Dubbing
                </>
              )}
            </button>
          </div>

          {/* Progress */}
          {processing && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm text-blue-200 mb-2">
                  <span>{currentStep}</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-2">
                {steps.map((step, index) => {
                  const stepProgress = Math.floor((progress / 100) * steps.length);
                  const isCompleted = index < stepProgress;
                  const isCurrent = index === stepProgress;
                  
                  return (
                    <div
                      key={index}
                      className={`p-3 rounded-lg text-center text-sm transition-all duration-300 ${
                        isCompleted
                          ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                          : isCurrent
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 animate-pulse'
                          : 'bg-white/10 text-gray-400 border border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-center mb-1">
                        {isCompleted ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : isCurrent ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <div className="w-4 h-4 border border-current rounded-full" />
                        )}
                      </div>
                      {step}
                    </div>
                  );
                })}
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
        {results && (
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              Dubbing Results
            </h2>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Text Results */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-medium text-blue-300">Original Transcript ({results.sourceLanguage})</h3>
                    <button
                      onClick={() => copyToClipboard(results.originalTranscript, 'transcript')}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors duration-200"
                      title="Copy transcript"
                    >
                      {copiedText === 'transcript' ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-blue-400" />
                      )}
                    </button>
                  </div>
                  <div className="bg-white/10 rounded-lg p-4 max-h-32 overflow-y-auto">
                    <p className="text-white text-sm">{results.originalTranscript}</p>
</div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-medium text-green-300">Translation ({results.targetLanguage})</h3>
                    <button
                      onClick={() => copyToClipboard(results.translation, 'translation')}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors duration-200"
                      title="Copy translation"
                    >
                      {copiedText === 'translation' ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-blue-400" />
                      )}
                    </button>
                  </div>
                  <div className="bg-white/10 rounded-lg p-4 max-h-32 overflow-y-auto">
                    <p className="text-white text-sm">{results.translation}</p>
                  </div>
                </div>

                <div className="text-center pt-4">
                  <button
                    onClick={downloadVideo}
                    className="px-6 py-3 bg-gradient-to-r from-green-500 to-blue-600 text-white rounded-lg font-medium hover:from-green-600 hover:to-blue-700 transition-all duration-200 flex items-center gap-2 mx-auto"
                  >
                    <Download className="w-5 h-5" />
                    Download Dubbed Video
                  </button>
                </div>
              </div>

              {/* Video Results */}
              <div>
                <h3 className="text-lg font-medium text-green-300 mb-2">Dubbed Video</h3>
                <div className="relative bg-black rounded-lg overflow-hidden">
                  <video
                    src={results.dubbedVideoUrl}
                    className="w-full max-h-64 object-contain"
                    controls
                    playsInline
                  />
                </div>
                <div className="mt-4 space-y-2 text-sm text-blue-200">
                  <p>Duration: {Math.round(results.originalDuration)}s</p>
                  <p>Language: {results.sourceLanguage} → {results.targetLanguage}</p>
                  <p>Voice: {selectedVoice}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        
      </div>
    </div>
  );
};

export default VideoDubber;