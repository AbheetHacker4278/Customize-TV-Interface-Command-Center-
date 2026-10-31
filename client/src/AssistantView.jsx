import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Mic, 
  MicOff, 
  Send, 
  Volume2, 
  VolumeX, 
  Tv, 
  CheckCircle, 
  Bot, 
  User, 
  Trash2, 
  Flame, 
  Terminal, 
  Cpu, 
  Play, 
  RotateCcw
} from 'lucide-react';
import { apiRequest, socket } from './api';

export default function AssistantView({ tvConnected, targetIp }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hello! I am your Smart TV AI Assistant powered by NVIDIA Nemotron. You can speak to me or type commands to control your Sony BRAVIA TV, launch apps, manage volume, or customize settings.",
      toolExecuted: null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechTranscript, setSpeechTranscript] = useState('');
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(true);
  const [tvTriggering, setTvTriggering] = useState(false);
  const [lastExecutedTool, setLastExecutedTool] = useState(null);

  const recognitionRef = useRef(null);
  const chatBottomRef = useRef(null);

  // Quick Action Chips
  const quickActions = [
    { label: "Play on Hotstar", query: "Play Brahmastra on Hotstar" },
    { label: "Play on YouTube", query: "Play Interstellar trailer on YouTube" },
    { label: "Watch on Netflix", query: "Watch Stranger Things on Netflix" },
    { label: "Set Volume to 25", query: "Set TV volume to 25%" },
    { label: "Clear TV Cache", query: "Clear application cache and optimize memory" },
    { label: "Open YouTube", query: "Open YouTube on my TV" },
    { label: "Switch to HDMI 1", query: "Switch input to HDMI 1" },
    { label: "Turn Off Screen", query: "Turn off the TV screen" },
    { label: "Change Wallpaper", query: "Change the home screen wallpaper" },
    { label: "Show Apps", query: "Show my installed TV applications" }
  ];

  // Initialize Web Speech API for voice input from Web Command Center
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechTranscript('');
      };

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setSpeechTranscript(transcript);
        if (event.results[0].isFinal) {
          handleSendMessage(transcript);
        }
      };

      recognition.onerror = (err) => {
        console.warn('Speech recognition error:', err);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    // Socket listeners for real-time tool events
    const handleToolEvent = (tool) => {
      setLastExecutedTool(tool);
    };

    socket.on('assistant_tool', handleToolEvent);

    return () => {
      socket.off('assistant_tool', handleToolEvent);
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }
    };
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Toggle voice recognition
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      setIsSpeaking(false);
      try {
        recognitionRef.current?.start();
      } catch (e) {
        console.warn(e);
      }
    }
  };

  // Speak AI response via Web Speech Synthesis
  const speakText = (text) => {
    if (!voiceOutputEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  // Send message to Nemotron Assistant API
  const handleSendMessage = async (textToSend = null) => {
    const text = (textToSend || inputText).trim();
    if (!text || isThinking) return;

    setInputText('');
    setSpeechTranscript('');

    const newMsg = {
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, newMsg]);
    setIsThinking(true);
    setLastExecutedTool(null);

    try {
      const historyPayload = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await apiRequest('/assistant/chat', 'POST', {
        message: text,
        history: historyPayload
      });

      setIsThinking(false);

      if (res && res.success) {
        const replyMsg = {
          role: 'assistant',
          content: res.reply,
          toolExecuted: res.toolExecuted,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, replyMsg]);
        speakText(res.reply);
      } else {
        const errorMsg = {
          role: 'assistant',
          content: res?.error || "I was unable to complete that request.",
          toolExecuted: null,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, errorMsg]);
      }
    } catch (err) {
      setIsThinking(false);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `Communication error: ${err.message || 'Unable to connect to AI engine'}`,
          toolExecuted: null,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  };

  // Summon Assistant directly on TV screen
  const triggerTvAssistant = async () => {
    setTvTriggering(true);
    try {
      await apiRequest('/assistant/trigger', 'POST');
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setTvTriggering(false), 1200);
    }
  };

  // Calculate Orb state style
  let orbClass = "transition-all duration-700 ease-out ";
  let glowClass = "transition-all duration-700 ";

  if (isListening) {
    orbClass += "scale-110 brightness-125 animate-pulse";
    glowClass += "scale-150 opacity-90 blur-2xl";
  } else if (isThinking) {
    orbClass += "scale-105 animate-spin duration-1000 brightness-110";
    glowClass += "scale-125 opacity-75 blur-xl";
  } else if (isSpeaking) {
    orbClass += "scale-115 brightness-125 animate-bounce";
    glowClass += "scale-140 opacity-80 blur-2xl";
  } else {
    orbClass += "scale-100 opacity-90 hover:scale-105 hover:opacity-100";
    glowClass += "scale-100 opacity-50 blur-lg";
  }

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Top Banner & TV Trigger Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-xl text-indigo-400">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-white tracking-wide">Sony BRAVIA AI Voice Assistant</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                NVIDIA Nemotron 120B
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Natural voice control & streaming tool execution for Sony BRAVIA 4K ({targetIp})
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setVoiceOutputEnabled(!voiceOutputEnabled)}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              voiceOutputEnabled 
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/30' 
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {voiceOutputEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{voiceOutputEnabled ? 'Voice Enabled' : 'Voice Muted'}</span>
          </button>

          <button
            onClick={triggerTvAssistant}
            disabled={tvTriggering}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-500/20 transition-all active:scale-95 disabled:opacity-50"
          >
            <Tv className="w-4 h-4" />
            <span>{tvTriggering ? 'Summoning on TV...' : 'Open Assistant on TV'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Orb & Controls | Right Conversation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        
        {/* Left Side: Siri Orb Visual Stage */}
        <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 flex flex-col items-center justify-between shadow-2xl relative overflow-hidden">
          {/* Subtle Stage Background */}
          <div className="absolute inset-0 bg-radial from-indigo-950/20 via-transparent to-transparent pointer-events-none" />

          {/* Status Indicator Pill */}
          <div className="z-10 inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 shadow-inner">
            <span className={`w-2 h-2 rounded-full ${
              isListening ? 'bg-cyan-400 animate-ping' :
              isThinking ? 'bg-purple-400 animate-pulse' :
              isSpeaking ? 'bg-emerald-400 animate-bounce' : 'bg-slate-500'
            }`} />
            <span className="text-[11px] font-semibold text-slate-300 tracking-wider uppercase">
              {isListening ? 'Listening for Voice...' :
               isThinking ? 'Thinking & Executing...' :
               isSpeaking ? 'Speaking Response...' : 'Ready (Double Press Mic on TV Remote)'}
            </span>
          </div>

          {/* Central Siri Glowing Orb */}
          <div className="relative my-8 flex items-center justify-center cursor-pointer group" onClick={toggleListening}>
            {/* Radiant Ambient Aura */}
            <div className={`absolute w-72 h-72 rounded-full bg-gradient-to-tr from-cyan-500/40 via-purple-500/40 to-pink-500/40 ${glowClass}`} />
            
            {/* Outer Ring */}
            <div className="absolute w-64 h-64 rounded-full border border-cyan-400/20 group-hover:border-cyan-400/50 transition-colors" />

            {/* Glowing Orb Artwork */}
            <div className="relative w-56 h-56 rounded-full overflow-hidden shadow-[0_0_50px_rgba(56,189,248,0.35)] border-2 border-cyan-400/30">
              <img 
                src="/siri_orb.jpg" 
                alt="Siri Glowing Orb" 
                className={`w-full h-full object-cover select-none pointer-events-none ${orbClass}`}
              />
            </div>
          </div>

          {/* Real-time Voice Transcription Banner */}
          <div className="w-full text-center z-10 px-4 min-h-[48px] flex items-center justify-center">
            {speechTranscript ? (
              <p className="text-sm font-medium text-cyan-300 italic bg-cyan-950/40 border border-cyan-800/40 px-3.5 py-1.5 rounded-xl animate-fade-in">
                "{speechTranscript}"
              </p>
            ) : isListening ? (
              <p className="text-xs text-slate-400 animate-pulse">Speak naturally into your microphone...</p>
            ) : (
              <p className="text-xs text-slate-500">Click the glowing orb or mic button below to talk</p>
            )}
          </div>

          {/* Action Button Controls */}
          <div className="w-full flex items-center justify-center space-x-3 z-10 mt-4">
            <button
              onClick={toggleListening}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl font-semibold text-xs shadow-lg transition-all active:scale-95 ${
                isListening
                  ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/25 animate-pulse'
                  : 'bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-cyan-500/20'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isListening ? 'Stop Listening' : 'Talk to TV'}</span>
            </button>

            {isSpeaking && (
              <button
                onClick={() => {
                  if (window.speechSynthesis) window.speechSynthesis.cancel();
                  setIsSpeaking(false);
                }}
                className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs transition-colors"
              >
                <VolumeX className="w-3.5 h-3.5" />
                <span>Interrupt</span>
              </button>
            )}
          </div>

          {/* Quick Command Chips */}
          <div className="w-full mt-6 pt-5 border-t border-slate-800/80 z-10">
            <span className="text-[11px] font-semibold text-slate-400 block mb-2.5">Suggested TV Voice Commands:</span>
            <div className="flex flex-wrap gap-1.5">
              {quickActions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(action.query)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-[11px] font-medium text-slate-300 border border-slate-700/60 hover:text-white transition-all text-left"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Conversation History & Chat Input */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800/80 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/60">
            <div className="flex items-center space-x-2">
              <Bot className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold text-white tracking-wide">Live Conversation Stream</span>
            </div>
            <button
              onClick={() => setMessages([])}
              className="text-slate-400 hover:text-slate-200 text-xs flex items-center space-x-1 px-2 py-1 rounded hover:bg-slate-800 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            {messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              return (
                <div key={index} className={`flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white ${
                    isUser ? 'bg-indigo-600' : 'bg-gradient-to-br from-cyan-500 to-blue-600'
                  }`}>
                    {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  <div className={`max-w-[82%] space-y-1.5`}>
                    <div className={`p-4 rounded-2xl text-xs leading-relaxed ${
                      isUser 
                        ? 'bg-indigo-600/90 text-white rounded-tr-none shadow-md' 
                        : 'bg-slate-800/90 text-slate-100 rounded-tl-none border border-slate-700/60 shadow-md'
                    }`}>
                      <p>{msg.content}</p>

                      {/* Tool Execution Tag */}
                      {msg.toolExecuted && (
                        <div className="mt-2.5 pt-2.5 border-t border-slate-700/60 flex items-center space-x-2 text-[11px] text-emerald-400 font-medium">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Action: {msg.toolExecuted.name} ({JSON.stringify(msg.toolExecuted.args || {})})</span>
                        </div>
                      )}
                    </div>

                    <div className={`text-[10px] text-slate-500 px-1 ${isUser ? 'text-right' : 'text-left'}`}>
                      {msg.timestamp}
                    </div>
                  </div>
                </div>
              );
            })}

            {isThinking && (
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white">
                  <Bot className="w-4 h-4 animate-spin" />
                </div>
                <div className="p-3.5 bg-slate-800/90 rounded-2xl rounded-tl-none border border-slate-700/60 text-xs text-slate-300 flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span>NVIDIA Nemotron is analyzing command & executing TV action...</span>
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Bottom Chat Input Form */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }} 
            className="p-4 bg-slate-900/95 border-t border-slate-800/80 flex items-center space-x-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask anything or command your TV (e.g. 'Open YouTube', 'Set volume 25')..."
              className="flex-1 bg-slate-950/80 border border-slate-700/70 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
            />

            <button
              type="button"
              onClick={toggleListening}
              className={`p-2.5 rounded-xl border transition-colors ${
                isListening 
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' 
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
              title="Voice Input"
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <button
              type="submit"
              disabled={!inputText.trim() || isThinking}
              className="p-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-white rounded-xl shadow-md transition-all active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
