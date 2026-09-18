import { useAuth } from "../../context/authContext";

const stats = [
  { label: "Active Fields", value: "12" },
  { label: "Pending Tasks", value: "4" },
  { label: "Open Service Requests", value: "2" },
];

const FarmerDashboardPage = () => {
  const { profile } = useAuth();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="mb-8">
        <p className="text-sm font-medium uppercase tracking-wide text-teal-400">
          Farmer
        </p>
        <h1 className="mt-1 text-3xl font-bold text-white">
          Welcome back{profile?.email ? `, ${profile.email}` : ""}
        </h1>
        <p className="mt-2 max-w-2xl text-slate-400">
          Monitor your fields, track tasks, and request technician support from
          one place.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"
          >
            <p className="text-sm text-slate-400">{s.label}</p>
            <p className="mt-2 text-3xl font-semibold text-teal-300">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
        <ul className="mt-4 space-y-3 text-sm text-slate-300">
          <li className="flex justify-between border-b border-slate-800 pb-3">
            <span>Irrigation scheduled for North Field</span>
            <span className="text-slate-500">2h ago</span>
          </li>
          <li className="flex justify-between border-b border-slate-800 pb-3">
            <span>Technician visit confirmed</span>
            <span className="text-slate-500">Yesterday</span>
          </li>
          <li className="flex justify-between">
            <span>Soil report uploaded</span>
            <span className="text-slate-500">3 days ago</span>
          </li>
        </ul>
      </section>
    </main>
  );
};

export default FarmerDashboardPage;
