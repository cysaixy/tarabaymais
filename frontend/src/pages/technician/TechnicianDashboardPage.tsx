import { useAuth } from "../../context/authContext";

const jobs = [
  { id: "JOB-1042", site: "North Field", status: "Scheduled", priority: "High" },
  { id: "JOB-1039", site: "Greenhouse 2", status: "In Progress", priority: "Medium" },
  { id: "JOB-1031", site: "Pump Station", status: "Awaiting Parts", priority: "Low" },
];

const priorityColor: Record<string, string> = {
  High: "text-red-300 bg-red-500/10",
  Medium: "text-amber-300 bg-amber-500/10",
  Low: "text-emerald-300 bg-emerald-500/10",
};

const TechnicianDashboardPage = () => {
  const { profile } = useAuth();

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="mb-8">
        <p className="text-sm font-medium uppercase tracking-wide text-indigo-400">
          Technician
        </p>
        <h1 className="mt-1 text-3xl font-bold text-white">
          Service Queue{profile?.email ? ` — ${profile.email}` : ""}
        </h1>
        <p className="mt-2 max-w-2xl text-slate-400">
          Review assigned jobs, update statuses, and manage field service
          requests.
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-800/60 text-slate-300">
            <tr>
              <th className="px-5 py-3 font-medium">Job</th>
              <th className="px-5 py-3 font-medium">Site</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Priority</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-t border-slate-800">
                <td className="px-5 py-3 font-mono text-slate-200">{job.id}</td>
                <td className="px-5 py-3 text-slate-300">{job.site}</td>
                <td className="px-5 py-3 text-slate-300">{job.status}</td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      priorityColor[job.priority]
                    }`}
                  >
                    {job.priority}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
};

export default TechnicianDashboardPage;
