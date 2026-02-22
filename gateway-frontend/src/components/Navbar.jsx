export default function Navbar() {
  const apiKey = localStorage.getItem("apiKey");

  return (
    <div className="flex justify-between p-4 bg-white/10 backdrop-blur-lg text-white">
      <h1 className="text-xl font-bold">🚀 API Gateway Dashboard</h1>
      <p className="text-sm bg-green-600 px-3 py-1 rounded">Key: {apiKey}</p>
    </div>
  );
}