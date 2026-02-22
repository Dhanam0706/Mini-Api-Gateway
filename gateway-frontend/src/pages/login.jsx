import { useState } from "react";
import axios from "axios"; // Assuming you use axios, or use fetch

export default function Login() {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!key.trim()) {
      setError("Please enter an API key.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 1. Call the Gateway's health or status route using the entered key
      const response = await axios.get("http://localhost:3000/health", {
        headers: { "x-api-key": key }
      });

      // 2. If the Gateway responds with 200 OK, the key is valid
      if (response.status === 200) {
        localStorage.setItem("apiKey", key);
        window.location.href = "/dashboard";
      }
    } catch (err) {
      // 3. If the Gateway returns 401, show 'Invalid Key'
      if (err.response && err.response.status === 401) {
        setError("Invalid API Key! Access Denied.");
      } else {
        setError("Cannot connect to Gateway. Is it running?");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex justify-center items-center bg-gradient-to-r from-purple-500 to-blue-500">
      <div className="bg-white p-8 rounded-xl shadow-xl w-96">
        <h1 className="text-2xl font-bold mb-4 text-center text-gray-800">API Gateway Login</h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <input
          className="border p-2 w-full mb-4 rounded text-black"
          placeholder="Enter API Key"
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        
        <button 
          onClick={handleLogin} 
          disabled={loading}
          className={`${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'} text-white px-4 py-2 rounded w-full transition`}
        >
          {loading ? "Verifying..." : "Login"}
        </button>
      </div>
    </div>
  );
}