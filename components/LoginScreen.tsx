import React, { useState } from 'react';
import { User, ArrowRight, Loader2 } from 'lucide-react';

interface LoginScreenProps {
  onLogin: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate auth delay
    setTimeout(() => {
      setLoading(false);
      onLogin();
    }, 1500);
  };

  return (
    <div className="h-screen w-screen bg-[url('https://images.unsplash.com/photo-1477346611705-65d1883cee1e?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center flex items-center justify-center relative">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm"></div>
      
      <div className="relative z-10 flex flex-col items-center">
         <div className="w-32 h-32 rounded-full bg-gray-200/20 backdrop-blur-md flex items-center justify-center mb-6 shadow-2xl border border-white/10">
            <User size={64} className="text-white" />
         </div>
         <h1 className="text-3xl text-white font-light mb-8 tracking-wide">Admin User</h1>
         
         {!loading ? (
             <form onSubmit={handleLogin} className="flex flex-col gap-4 w-64">
                <div className="relative">
                    <input 
                      type="password" 
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-black/30 text-white placeholder-gray-300 px-4 py-2 rounded border border-white/20 focus:outline-none focus:bg-black/50 focus:border-white/50 transition"
                    />
                    <button 
                      type="submit"
                      className="absolute right-1 top-1 bg-white/10 hover:bg-white/30 p-1.5 rounded text-white transition"
                    >
                      <ArrowRight size={16} />
                    </button>
                </div>
                <div className="text-white/60 text-xs text-center cursor-pointer hover:underline">
                    Forgot my password
                </div>
             </form>
         ) : (
             <div className="flex flex-col items-center gap-3">
                 <Loader2 size={32} className="text-white animate-spin" />
                 <span className="text-white/80 text-sm">Welcome</span>
             </div>
         )}
      </div>

      <div className="absolute bottom-8 right-8 text-white/80 text-5xl font-thin tracking-tighter">
          12:45
      </div>
      <div className="absolute bottom-4 right-9 text-white/60 text-lg">
          Sunday, October 29
      </div>
    </div>
  );
};

export default LoginScreen;