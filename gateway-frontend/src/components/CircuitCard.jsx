export default function CircuitCard({ name, data }) {
  // Use a cleaner status indicator
  const status = data.open ? "OPEN 🔴" : "CLOSED 🟢";

  return (
    <div className="bg-white/10 p-4 rounded border border-white/5 backdrop-blur-lg text-white shadow-md">
      <h2 className="text-lg font-bold border-b border-white/10 pb-2 mb-2">{name}</h2>
      
      <div className="space-y-1">
        <p className="flex justify-between">
          <span className="text-gray-400">Status:</span>
          <span className="font-mono font-bold">{status}</span>
        </p>

        <p className="flex justify-between">
          <span className="text-gray-400">Failure Count:</span>
          <span className={data.failures > 0 ? "text-yellow-500" : "text-green-400"}>
            {data.failures}
          </span>
        </p>

        <p className="flex justify-between text-sm pt-2">
          <span className="text-gray-500">Last Incident:</span>
          <span className="text-gray-300 italic">
            {/* Only show the time if data.lastFailureTime exists 
               and the circuit is actually struggling (failures > 0) 
               or currently open.
            */}
            {data.lastFailureTime && data.failures > 0
              ? new Date(data.lastFailureTime).toLocaleTimeString()
              : "No recent issues"}
          </span>
        </p>
      </div>
    </div>
  );
}