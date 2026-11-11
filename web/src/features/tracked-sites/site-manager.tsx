import { deleteTrackedSite, saveTrackedSite } from "./actions";
import type { Database } from "@/lib/supabase/database.types";

type TrackedSite = Database["public"]["Tables"]["tracked_sites"]["Row"];

export function SiteManager({ sites }: { sites: TrackedSite[] }) {
  return (
    <section className="feature-card" id="job-sites">
      <div className="section-title">
        <div>
          <p className="eyebrow">01 · Job sites</p>
          <h2>Tracked websites</h2>
        </div>
        <span className="count-pill">{sites.length}</span>
      </div>
      <form action={saveTrackedSite} className="mb-5 grid gap-3 sm:grid-cols-[1fr_1.5fr_auto]">
        <input
          className="form-input"
          name="label"
          placeholder="Site name"
          required
          maxLength={100}
        />
        <input
          className="form-input"
          name="url"
          type="url"
          placeholder="https://careers.example.com"
          required
          maxLength={2048}
        />
        <button className="button-primary" type="submit">
          Add site
        </button>
      </form>
      {sites.length === 0 ? (
        <p className="empty-state">
          No tracked sites yet. Add the career sites you want to keep handy.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {sites.map((site) => (
            <li className="grid gap-3 py-4 sm:grid-cols-[1fr_auto]" key={site.id}>
              <form action={saveTrackedSite} className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]">
                <input name="id" type="hidden" value={site.id} />
                <input
                  className="form-input"
                  name="label"
                  defaultValue={site.label}
                  required
                  maxLength={100}
                />
                <input
                  className="form-input"
                  name="url"
                  type="url"
                  defaultValue={site.url}
                  required
                  maxLength={2048}
                />
                <button className="button-secondary" type="submit">
                  Update
                </button>
              </form>
              <form action={deleteTrackedSite}>
                <input name="id" type="hidden" value={site.id} />
                <button className="button-danger" type="submit">
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
