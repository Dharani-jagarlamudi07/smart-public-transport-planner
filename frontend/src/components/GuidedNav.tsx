"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  ChevronRight,
  ArrowRight,
  Bus,
  Train,
  Footprints,
  Flag,
  Volume2,
  VolumeX,
  Pause,
  Play,
} from "lucide-react";
import type { Itinerary } from "@/lib/api";

type Props = {
  itinerary: Itinerary;
  onComplete: () => void;
};

const getSpokenInstruction = (leg: any, index: number) => {
  const mode = leg.mode.toUpperCase();
  const distKm = (leg.distance_m / 1000).toFixed(1);

  if (index === 0) {
    return `Start your journey. Walk ${distKm} kilometers to ${leg.from.name}.`;
  }
  if (mode === "WALK") {
    return `Walk ${distKm} kilometers towards ${leg.to.name}.`;
  } else if (mode === "BUS") {
    return `Take bus ${leg.route_short_name || "express"} towards ${leg.to.name}.`;
  } else if (mode === "METRO" || mode === "SUBWAY") {
    return `Board Metro line ${leg.route_short_name || ""} heading to ${leg.to.name}.`;
  } else if (mode === "TRAIN" || mode === "RAIL") {
    return `Take the train towards ${leg.to.name}.`;
  }
  return `Proceed via ${mode} to ${leg.to.name}.`;
};

export default function GuidedNav({ itinerary, onComplete }: Props) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  const legs = itinerary.legs;
  const currentLeg = legs[currentStepIndex];
  const nextLeg = legs[currentStepIndex + 1];
  const isLastStep = currentStepIndex === legs.length - 1;

  const lastSpokenIndex = useRef(-1);

  const speak = (text: string) => {
    if (!voiceEnabled || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find((v) => v.lang.includes("en"));
    if (englishVoice) utterance.voice = englishVoice;
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (currentLeg && currentStepIndex !== lastSpokenIndex.current) {
      speak(getSpokenInstruction(currentLeg, currentStepIndex));
      lastSpokenIndex.current = currentStepIndex;
    }
  }, [currentStepIndex, currentLeg, voiceEnabled]);

  useEffect(() => {
    if (!isPlaying || isLastStep) return;
    const timer = setTimeout(() => setCurrentStepIndex((prev) => prev + 1), 6000);
    return () => clearTimeout(timer);
  }, [currentStepIndex, isPlaying, isLastStep]);

  useEffect(() => {
    if (isLastStep && !isPlaying) {
      speak("You have arrived at your destination.");
      setTimeout(onComplete, 2000);
    }
  }, [isLastStep, isPlaying, onComplete]);

  const getInstructionIcon = (mode: string) => {
    switch (mode.toUpperCase()) {
      case "WALK":
        return <Footprints className="w-6 h-6 text-emerald-300" />;
      case "BUS":
        return <Bus className="w-6 h-6 text-blue-300" />;
      case "METRO":
      case "SUBWAY":
        return <Train className="w-6 h-6 text-red-300" />;
      case "TRAIN":
        return <Train className="w-6 h-6 text-purple-300" />;
      default:
        return <ChevronRight className="w-6 h-6 text-emerald-300" />;
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[2000] px-4 pb-6 pt-2 pointer-events-none">
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="max-w-md mx-auto glass-dark text-white rounded-2xl overflow-hidden pointer-events-auto"
      >
        {/* Header */}
        <div className="bg-white/5 px-4 py-3 flex justify-between items-center border-b border-white/10">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
            <Volume2 className="w-4 h-4" /> Live Voice Guidance
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setVoiceEnabled(!voiceEnabled);
                if (voiceEnabled) window.speechSynthesis.cancel();
              }}
              className={`p-1.5 rounded-full transition-colors ${
                voiceEnabled ? "bg-emerald-400/20 text-emerald-300" : "bg-white/10 text-slate-400"
              }`}
            >
              {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-slate-300"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className="bg-white/10 p-3 rounded-xl border border-white/15 shrink-0">
              {getInstructionIcon(currentLeg.mode)}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold leading-tight mb-1">
                {currentLeg.mode === "WALK" ? "Head Out" : `Board ${currentLeg.route_short_name || currentLeg.mode}`}
              </h2>
              <p className="text-sm text-slate-300 font-medium">
                {getSpokenInstruction(currentLeg, currentStepIndex)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>STEP {currentStepIndex + 1} OF {legs.length}</span>
              <span>{Math.round(((currentStepIndex + 1) / legs.length) * 100)}%</span>
            </div>
            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
              <motion.div
                className="bg-emerald-400 h-full"
                initial={{ width: 0 }}
                animate={{ width: `${((currentStepIndex + 1) / legs.length) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          {!isLastStep && (
            <div className="bg-white/5 rounded-xl p-3 flex items-center gap-3 border border-white/10">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-slate-300">
                NEXT
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-200 truncate">{nextLeg?.to.name}</div>
                <div className="text-[10px] text-slate-400">
                  {nextLeg?.mode} • {Math.round((nextLeg?.distance_m || 0) / 1000)}km
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </div>
          )}

          {isLastStep && (
            <div className="bg-emerald-400/10 rounded-xl p-3 flex items-center gap-3 border border-emerald-400/20">
              <Flag className="w-5 h-5 text-emerald-300" />
              <div className="text-sm font-bold text-emerald-200">Destination Reached</div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}