import { useEffect, useState } from "react";
import API from "../api/gatewayApi";
import Navbar from "../components/Navbar";
import StatusCard from "../components/StatusCard";
import RateLimitBar from "../components/RateLimitBar";
import CircuitCard from "../components/CircuitCard";
import CacheButton from "../components/cacheButton";

export default function Dashboard() {
  const apiKey = localStorage.getItem("apiKey");

  // State Management
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [userStatus, setUserStatus] = useState(false);
  const [orderStatus, setOrderStatus] = useState(false);
  const [gateway, setGateway] = useState({ uptime: 0 });
  const [rateLimit, setRateLimit] = useState({ tokens: 10 });
  const [circuit, setCircuit] = useState({});
  const [errorMessage, setErrorMessage] = useState("");

  async function fetchAll() {
    try {
      // Parallel requests ensure we don't wait for one service to finish before starting another
      const [uRes, oRes, gRes, rRes, cRes] = await Promise.allSettled([
        API.get("/api/users", { headers: { "x-api-key": apiKey } }),
        API.get("/api/orders", { headers: { "x-api-key": apiKey } }),
        API.get("/gateway/status"),
        API.get(`/gateway/ratelimit/${apiKey}`),
        API.get("/gateway/circuit-status")
      ]);

      // --- Process Users (Stale-While-Revalidate Logic) ---
      if (uRes.status === "fulfilled") {
        const userData = uRes.value.data?.data?.users || uRes.value.data?.users || [];
        // Only update if data exists to prevent "invisible" users on minor blips
        if (Array.isArray(userData) && userData.length > 0) {
          setUsers(userData);
        }
        setUserStatus(true);
        setErrorMessage(""); 
      } else {
        setUserStatus(false);
        // We DO NOT call setUsers([]). This keeps names on screen during 429 errors.
        if (uRes.reason.response?.status === 429) {
          setErrorMessage("⚠️ Rate Limit Exceeded! Showing last known data.");
        } else {
          setErrorMessage("❌ User Service Connection Error.");
        }
      }

      // --- Process Orders ---
      if (oRes.status === "fulfilled") {
        const orderData = oRes.value.data?.data?.orders || oRes.value.data?.orders || [];
        if (Array.isArray(orderData) && orderData.length > 0) {
          setOrders(orderData);
        }
        setOrderStatus(true);
      } else {
        setOrderStatus(false);
      }

      // --- Process Gateway & Status (Defensive checking) ---
      if (gRes.status === "fulfilled") {
        const gData = gRes.value.data?.data || gRes.value.data || { uptime: 0 };
        setGateway(gData);
      }
      
      if (rRes.status === "fulfilled") {
        setRateLimit(rRes.value.data);
      }

      if (cRes.status === "fulfilled") {
        setCircuit(cRes.value.data);
      }

    } catch (globalErr) {
      console.error("Dashboard critical fetch error:", globalErr);
    }
  }

  useEffect(() => {
    fetchAll();
    // 10 seconds allows a 5/s refill rate to completely fill the bucket (10 tokens)
    const interval = setInterval(fetchAll, 10000); 
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen text-white bg-black">
      <Navbar />

      {/* Global Error Alert */}
      {errorMessage && (
        <div className="mx-6 mt-4 p-4 bg-red-600/90 border border-red-400 text-white rounded animate-pulse shadow-lg">
          <p className="font-bold">{errorMessage}</p>
        </div>
      )}

      {/* Status Overview Cards */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard title="User Service" status={userStatus} />
        <StatusCard title="Order Service" status={orderStatus} />
        
        {/* Gateway Uptime Card */}
        <div className="bg-white/10 p-4 rounded border border-white/5 backdrop-blur-lg">
          <h2 className="font-bold text-gray-400 text-sm uppercase">⚡ Gateway Uptime</h2>
          <p className="text-xl">
            {(gateway?.uptime || 0).toFixed(2)} sec
          </p>
        </div>

        <RateLimitBar tokens={rateLimit.tokens} />
      </div>

      {/* Circuit Breaker Status Row */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {circuit.userService && (
          <CircuitCard name="User Service Circuit" data={circuit.userService} />
        )}
        {circuit.orderService && (
          <CircuitCard name="Order Service Circuit" data={circuit.orderService} />
        )}
      </div>
      
      {/* Data Display Tables */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Service Table */}
        <div className="bg-white/10 p-4 rounded border border-white/5">
          <h2 className="font-bold mb-4 flex items-center gap-2">
            👤 Users (Live) {!userStatus && users.length > 0 && <span className="text-xs text-yellow-500 italic">(Cached)</span>}
          </h2>
          <div className={`space-y-2 ${!userStatus ? 'opacity-50' : ''}`}>
            {users && users.length > 0 ? (
              users.map((u, i) => (
                <div key={i} className="p-2 bg-white/5 rounded border border-white/5">{u}</div>
              ))
            ) : (
              <p className="text-gray-500 italic">No users available.</p>
            )}
          </div>
        </div>

        {/* Order Service Table */}
        <div className="bg-white/10 p-4 rounded border border-white/5">
          <h2 className="font-bold mb-4 flex items-center gap-2">
            📦 Orders (Live) {!orderStatus && orders.length > 0 && <span className="text-xs text-yellow-500 italic">(Cached)</span>}
          </h2>
          <div className={`space-y-2 ${!orderStatus ? 'opacity-50' : ''}`}>
            {orders && orders.length > 0 ? (
              orders.map((o, i) => (
                <div key={i} className="p-2 bg-white/5 rounded border border-white/5">{o}</div>
              ))
            ) : (
              <p className="text-gray-500 italic">No orders available.</p>
            )}
          </div>
        </div>
      </div>

      {/* Cache Management Section */}
      <div className="p-6 pt-0 max-w-md">
        <CacheButton />
      </div>
    </div>
  );
}