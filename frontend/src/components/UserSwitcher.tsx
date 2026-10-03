"use client";
import { useState, useEffect } from "react";
import { User, ChevronDown, LogOut } from "lucide-react";
import { isLoggedIn, clearToken } from "@/lib/auth";
import { useRouter } from "next/navigation";

const USERS = ["Guest", "Alice (Commuter)", "Bob (Student)", "Admin"];

export default function UserSwitcher() {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setLoggedIn(isLoggedIn());
  }, []);

  const handleLogout = () => {
    clearToken();
    setLoggedIn(false);
    router.refresh(); // Refresh page to update state
    setIsOpen(false);
  };

  if (loggedIn) {
    return (
      <div className="relative">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-sm font-medium text-emerald-700 transition-colors"
        >
          <User className="w-4 h-4" />
          Logged In
          <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50 animate-in fade-in slide-in-from-top-2">
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 hover:text-red-600 text-slate-600 flex items-center gap-2 transition-colors"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // Default Guest View
  return (
    <div className="relative">
       <button 
        onClick={() => router.push('/login')}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm font-medium text-slate-700 transition-colors"
      >
        <User className="w-4 h-4 text-slate-400" />
        Sign In
      </button>
    </div>
  );
}