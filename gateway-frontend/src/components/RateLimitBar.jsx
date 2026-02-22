export default function RateLimitBar({ tokens }) {
  const maxTokens = 10;
  const percent = Math.min((tokens / maxTokens) * 100, 100);

  let color = "bg-green-500";
  if (percent < 50) color = "bg-yellow-500";
  if (percent < 20) color = "bg-red-500";

  return (
    <div className="bg-white/10 p-4 rounded backdrop-blur-lg text-white">
      <h2 className="text-lg font-bold">🚦 API Rate Limit</h2>

      <div className="w-full bg-gray-700 rounded h-4 mt-2">
        <div
          className={`${color} h-4 rounded transition-all duration-500`}
          style={{ width: `${percent}%` }}
        ></div>
      </div>

      <p className="mt-2 text-sm">
        Tokens Left: <span className="font-bold">{tokens?.toFixed(0)}</span> / {maxTokens}
      </p>
    </div>
  );
}