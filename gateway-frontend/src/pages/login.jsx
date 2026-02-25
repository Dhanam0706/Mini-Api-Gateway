import { useState } from "react";
import axios from "axios";

export default function Login() {
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!credentials.username || !credentials.password) {
      setError("Please enter both username and password.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const response = await axios.post("http://localhost:3000/auth/login", credentials);
      if (response.data.apiKey) {
        localStorage.setItem("apiKey", response.data.apiKey);
        window.location.href = "/dashboard";
      }
    } catch (err) {
      if (err.response && err.response.status === 401) {
        setError("Invalid username or password.");
      } else {
        setError("Gateway is offline. Check backend server.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex justify-center items-center bg-black">
      <div className="bg-zinc-900 p-8 rounded-2xl border border-white/10 shadow-2xl w-96">
        <h1 className="text-3xl font-bold mb-6 text-center text-white">Gateway Login</h1>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-3 py-2 rounded-lg mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase text-gray-500 font-bold mb-1 block">Username</label>
            <input
              className="bg-black border border-white/10 p-3 w-full rounded-lg text-white focus:outline-none focus:border-blue-500 transition"
              type="text"
              value={credentials.username}
              onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs uppercase text-gray-500 font-bold mb-1 block">Password</label>
            <input
              className="bg-black border border-white/10 p-3 w-full rounded-lg text-white focus:outline-none focus:border-blue-500 transition"
              placeholder="••••••••"
              type="password"
              value={credentials.password}
              onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
            />
          </div>
          
          <button 
            onClick={handleLogin} 
            disabled={loading}
            className={`${
              loading ? 'bg-gray-700' : 'bg-blue-600 hover:bg-blue-500'
            } text-white font-bold py-3 rounded-lg w-full mt-4 transition-all shadow-lg shadow-blue-900/20`}
          >
            {loading ? "Authenticating..." : "Sign In"}
          </button>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          Protected by AES-256 Gateway Encryption
        </p>
      </div>
    </div>
  );
}