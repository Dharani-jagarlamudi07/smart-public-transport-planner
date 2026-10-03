"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Phone, ShieldCheck, Loader2, ArrowLeft, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { setToken } from "@/lib/auth"; // Ensure this helper exists in lib/auth.ts

// Simple API helper for auth endpoints
const apiCall = async (endpoint: string, method: string, body?: any) => {
  const res = await fetch(`/api${endpoint}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || "Authentication failed");
  }
  
  return res.json();
};

export default function LoginPage() {
  const router = useRouter();
  
  // State Management
  const [step, setStep] = useState<"input" | "otp">("input");
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoOtp, setDemoOtp] = useState<string | null>(null); // Stores the OTP returned by backend for display

  // Handle Sending OTP Request
  const handleSendOtp = async () => {
    if (!identifier.trim()) return;
    
    setLoading(true);
    setError(null);
    setDemoOtp(null);
    
    try {
      const res = await apiCall("/auth/send-otp", "POST", {
        identifier: identifier.trim(),
        type: method,
      });
      
      // HACKATHON FEATURE: Display the OTP immediately on screen
      if (res.otp_code) {
        setDemoOtp(res.otp_code);
      }
      
      setStep("otp");
    } catch (e: any) {
      setError(e.message || "Failed to send OTP. Is backend running?");
    } finally {
      setLoading(false);
    }
  };

  // Handle Verifying OTP
  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await apiCall("/auth/verify-otp", "POST", {
        identifier: identifier.trim(),
        otp_code: otp,
        type: method,
      });
      
      // Save Session Token to LocalStorage
      if (res.user_id) {
        setToken(res.user_id);
        
        // Small delay for UX polish before redirect
        setTimeout(() => {
          router.push("/");
        }, 500);
      } else {
        throw new Error("Invalid session received");
      }
      
    } catch (e: any) {
      setError(e.message || "Invalid OTP. Please try again.");
      setOtp(""); // Clear input on failure
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Animated Background Blobs */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1], 
          rotate: [0, 90, 0],
          opacity: [0.3, 0.5, 0.3]
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-200 blur-3xl z-0"
      />
      <motion.div 
        animate={{ 
          scale: [1.2, 1, 1.2], 
          rotate: [90, 0, 90],
          opacity: [0.3, 0.5, 0.3]
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-200 blur-3xl z-0"
      />

      {/* Main Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-8 relative z-10"
      >
        {/* Back Link */}
        <Link href="/" className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-600 mb-8 transition-colors group">
          <ArrowLeft className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" /> 
          Continue as Guest
        </Link>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Secure Access</h1>
          <p className="text-sm text-slate-500 mt-2">Sign in to sync your saved routes & preferences</p>
        </div>

        {step === "input" ? (
          /* STEP 1: INPUT IDENTIFIER */
          <div className="space-y-6">
            
            {/* Method Toggle Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl relative">
              <motion.div 
                layoutId="activeTab"
                className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-lg shadow-sm ${method === 'email' ? 'left-1' : 'right-1'}`}
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
              
              <button
                onClick={() => setMethod("email")}
                className={`relative z-10 flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors ${method === "email" ? "text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
              >
                <Mail className="inline w-4 h-4 mr-2" /> Email
              </button>
              <button
                onClick={() => setMethod("phone")}
                className={`relative z-10 flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors ${method === "phone" ? "text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
              >
                <Phone className="inline w-4 h-4 mr-2" /> Phone
              </button>
            </div>

            {/* Input Field */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider ml-1">
                {method === "email" ? "Email Address" : "Mobile Number"}
              </label>
              <div className="relative">
                <input
                  type={method === "email" ? "email" : "tel"}
                  placeholder={method === "email" ? "commuter@example.com" : "+91 98765 43210"}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                  className="w-full px-4 py-3.5 pl-10 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-slate-800 placeholder:text-slate-400 bg-white/50"
                />
                <div className="absolute left-3.5 top-3.5 text-slate-400">
                  {method === "email" ? <Mail className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
                </div>
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="text-xs text-red-600 bg-red-50 border border-red-100 p-3 rounded-lg flex items-start gap-2"
              >
                <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}

            <button
              onClick={handleSendOtp}
              disabled={loading || !identifier.trim()}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-slate-900/20 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Sending Code...
                </>
              ) : (
                "Get Verification Code"
              )}
            </button>
          </div>
        ) : (
          /* STEP 2: ENTER OTP */
          <div className="space-y-6">
            
            <div className="text-center space-y-3">
              <p className="text-sm text-slate-600">
                We sent a 6-digit code to <br/>
                <span className="font-bold text-slate-900 break-all">{identifier}</span>
              </p>
              
              {/* DEMO HELPER BOX - CRITICAL FOR HACKATHONS */}
              {demoOtp && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-left shadow-sm"
                >
                  <div className="flex items-center gap-2 text-yellow-800 font-bold text-xs uppercase tracking-wide mb-1">
                    <Sparkles className="w-3 h-3" /> Demo Mode Active
                  </div>
                  <p className="text-xs text-yellow-700 mb-2">No real SMS/Email sent. Use this code:</p>
                  <div className="bg-white border border-yellow-300 rounded-lg p-2 text-center font-mono text-2xl font-black text-yellow-900 tracking-widest select-all cursor-pointer hover:bg-yellow-50 transition-colors" onClick={() => navigator.clipboard.writeText(demoOtp)}>
                    {demoOtp}
                  </div>
                  <p className="text-[10px] text-yellow-600 mt-2 text-center">(Click to copy)</p>
                </motion.div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider ml-1">Enter Code</label>
              <input
                type="text"
                maxLength={6}
                placeholder="••••••"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                autoFocus
                className="w-full px-4 py-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-center text-2xl font-mono font-bold tracking-[0.5em] text-slate-800 placeholder:text-slate-300 bg-white/50"
              />
            </div>

            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-100 p-3 rounded-lg text-center">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setStep("input");
                  setOtp("");
                  setError(null);
                }}
                className="flex-1 py-3.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-sm transition-colors"
              >
                Change Info
              </button>
              <button
                onClick={handleVerifyOtp}
                disabled={loading || otp.length !== 6}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/20 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Verify & Login"
                )}
              </button>
            </div>
          </div>
        )}
        
        {/* Footer Note */}
        <div className="mt-8 text-center">
          <p className="text-[10px] text-slate-400 leading-relaxed">
            By signing in, you agree to our Terms of Service.<br/>
            Protected by Smart Planner Auth Engine v1.0
          </p>
        </div>
      </motion.div>
    </div>
  );
}