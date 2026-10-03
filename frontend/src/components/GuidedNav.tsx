"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronRight, 
  ArrowRight, 
  Bus, 
  Train, 
  Footprints, 
  Flag, 
  Volume2, 
  Pause, 
  Play,
  MapPin,
  Speaker
} from "lucide-react";
import type { Itinerary, Leg } from "@/lib/api";

type Props = {
  itinerary: Itinerary;
  onComplete: () => void;
};

// Helper to generate spoken text for a leg
const getSpokenInstruction = (leg: Leg, index: number, totalLegs: number) => {
  const mode = leg.mode.toUpperCase();
  const distKm = (leg.distance_m / 1000).toFixed(1);
  
  if (index === 0) {
    return `Start your journey. Walk ${distKm} kilometers to ${leg.from.name}.`;
  }
  
  if (mode === "WALK") {
    return `Walk ${distKm} kilometers towards ${leg.to.name}.`;
  } else if (mode === "BUS") {
    return `Take bus ${leg.route_short_name || 'express'} towards ${leg.to.name}.`;
  } else if (mode === "METRO" || mode === "SUBWAY") {
    return `Board Metro line ${leg.route_short_name || ''} heading to ${leg.to.name}.`;
  } else if (mode === "TRAIN" || mode === "RAIL") {
    return `Take the train towards ${leg.to.name}.`;
  } else {
    return `Proceed via ${mode} to ${leg.to.name}.`;
  }
};

export default function GuidedNav({ itinerary, onComplete }: Props) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  
  const legs = itinerary.legs;
  const currentLeg = legs[currentStepIndex];
  const nextLeg = legs[currentStepIndex + 1];
  const isLastStep = currentStepIndex === legs.length - 1;

  // Ref to prevent speech synthesis queue buildup
  const lastSpokenIndex = useRef(-1);

  // Speak function
  const speak = (text: string) => {
    if (!voiceEnabled || typeof window === "undefined" || !window.speechSynthesis) return;
    
    // Cancel any ongoing speech to avoid overlap
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9; // Slightly slower for clarity
    utterance.pitch = 1;
    utterance.volume = 1;
    
    // Try to pick a good English voice if available
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.includes('en'));
    if (englishVoice) utterance.voice = englishVoice;

    window.speechSynthesis.speak(utterance);
  };

  // Effect: Speak when step changes
  useEffect(() => {
    if (currentLeg && currentStepIndex !== lastSpokenIndex.current) {
      const instruction = getSpokenInstruction(currentLeg, currentStepIndex, legs.length);
      speak(instruction);
      lastSpokenIndex.current = currentStepIndex;
    }
  }, [currentStepIndex, currentLeg, legs.length, voiceEnabled]);

  // Auto-advance simulation
  useEffect(() => {
    if (!isPlaying || isLastStep) return;

    const timer = setTimeout(() => {
      setCurrentStepIndex(prev => prev + 1);
    }, 6000); // Advance every 6 seconds

    return () => clearTimeout(timer);
  }, [currentStepIndex, isPlaying, isLastStep]);

  // Handle completion
  useEffect(() => {
    if (isLastStep && !isPlaying) {
      speak("You have arrived at your destination.");
      setTimeout(onComplete, 2000);
    }
  }, [isLastStep, isPlaying, onComplete]);

  const getInstructionIcon = (mode: string) => {
    switch(mode.toUpperCase()) {
      case 'WALK': return <Footprints className="w-6 h-6 text-slate-600" />;
      case 'BUS': return <Bus className="w-6 h-6 text-blue-600" />;
      case 'METRO': case 'SUBWAY': return <Train className="w-6 h-6 text-red-600" />;
      case 'TRAIN': return <Train className="w-6 h-6 text-purple-600" />;
      default: return <ChevronRight className="w-6 h-6 text-green-600" />;
    }
  };

  const getNextActionText = () => {
    if (!nextLeg) return "Arrived at Destination";
    
    const distKm = (nextLeg.distance_m / 1000).toFixed(1);
    const timeMin = Math.round(nextLeg.duration_sec / 60);
    
    if (nextLeg.mode === "WALK") {
      return `Walk ${distKm}km (${timeMin} min) to ${nextLeg.to.name}`;
    }
    return `Take ${nextLeg.mode} towards ${nextLeg.to.name}`;
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[2000] px-4 pb-6 pt-2 pointer-events-none">
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="max-w-md mx-auto bg-slate-900 text-white rounded-2xl shadow-2xl overflow-hidden border border-slate-700 pointer-events-auto"
      >
        {/* Header Bar */}
        <div className="bg-slate-800 px-4 py-3 flex justify-between items-center border-b border-slate-700">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
            <Speaker className={`w-4 h-4 ${voiceEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
            Live Voice Guidance
          </div>
          
          <div className="flex items-center gap-2">
             {/* Voice Toggle */}
             <button 
              onClick={() => {
                setVoiceEnabled(!voiceEnabled);
                if (!voiceEnabled) speak("Voice guidance enabled.");
                else window.speechSynthesis.cancel();
              }}
              className={`p-1.5 rounded-full transition-colors ${voiceEnabled ? 'bg-emerald-900/50 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}
              title={voiceEnabled ? "Mute Voice" : "Enable Voice"}
            >
              {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>

            {/* Play/Pause Auto-Advance */}
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-1.5 hover:bg-slate-700 rounded-full transition-colors text-slate-300"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Main Instruction Area */}
        <div className="p-6 space-y-4">
          
          {/* Current Action Icon & Text */}
          <div className="flex items-start gap-4">
            <div className="bg-emerald-500/20 p-3 rounded-xl border border-emerald-500/30 shrink-0">
              {getInstructionIcon(currentLeg.mode)}
            </div>
            
            <div className="flex-1">
              <h2 className="text-xl font-bold leading-tight mb-1 text-white">
                {currentLeg.mode === "WALK" ? "Head Out" : `Board ${currentLeg.route_short_name || currentLeg.mode}`}
              </h2>
              <p className="text-sm text-slate-300 font-medium">
                {getSpokenInstruction(currentLeg, currentStepIndex, legs.length)}
              </p>
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>STEP {currentStepIndex + 1} OF {legs.length}</span>
              <span>{Math.round(((currentStepIndex + 1) / legs.length) * 100)}%</span>
            </div>
            <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <motion.div 
                className="bg-emerald-500 h-full"
                initial={{ width: 0 }}
                animate={{ width: `${((currentStepIndex + 1) / legs.length) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          {/* Next Up Preview */}
          {!isLastStep && (
            <div className="bg-slate-800/50 rounded-lg p-3 flex items-center gap-3 border border-slate-700/50 mt-2">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-400">
                NEXT
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-300 truncate">
                  {nextLeg?.to.name}
                </div>
                <div className="text-[10px] text-slate-500">
                  {nextLeg?.mode} • {Math.round((nextLeg?.distance_m || 0)/1000)}km
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500" />
            </div>
          )}
          
          {isLastStep && (
             <div className="bg-emerald-900/30 rounded-lg p-3 flex items-center gap-3 border border-emerald-800/50 mt-2">
               <Flag className="w-5 h-5 text-emerald-400" />
               <div className="text-sm font-bold text-emerald-200">Destination Reached</div>
             </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}