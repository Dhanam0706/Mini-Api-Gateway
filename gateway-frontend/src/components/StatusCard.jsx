export default function StatusCard({ title, status }) {
  return (
    <div className="bg-white/10 p-5 rounded-xl shadow text-white backdrop-blur-lg">
      <h2 className="text-lg">{title}</h2>
      <p className={`text-xl font-bold ${status ? "text-green-400" : "text-red-500"}`}>
        {status ? "ONLINE" : "DOWN"}
      </p>
    </div>
  );
}