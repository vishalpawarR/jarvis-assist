import { deletePage, savePage } from "./actions";
import type { Database } from "@/lib/supabase/database.types";

type SavedPage = Database["public"]["Tables"]["saved_pages"]["Row"];

export function PageManager({ pages }: { pages: SavedPage[] }) {
  return (
    <section className="feature-card" id="saved-pages">
      <div className="section-title">
        <div>
          <p className="eyebrow">02 · Reading list</p>
          <h2>Saved pages</h2>
        </div>
        <span className="count-pill">{pages.length}</span>
      </div>
      <form action={savePage} className="mb-5 grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="form-input"
            name="title"
            placeholder="Page title"
            required
            maxLength={300}
          />
          <input
            className="form-input"
            name="url"
            type="url"
            placeholder="https://example.com/article"
            required
            maxLength={2048}
          />
        </div>
        <textarea
          className="form-input min-h-20"
          name="selectedText"
          placeholder="Optional notes or selected text"
          maxLength={5000}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="field-label flex-row items-center gap-2">
            Save to
            <select className="form-input w-auto" name="collection" defaultValue="keep_forever">
              <option value="keep_forever">Keep forever</option>
              <option value="read_later">Read later (30-day expiry)</option>
            </select>
          </label>
          <button className="button-primary" type="submit">
            Save page
          </button>
        </div>
      </form>
      {pages.length === 0 ? (
        <p className="empty-state">Your library is empty. Save pages you want to read or keep.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {pages.map((page) => (
            <li className="py-4" key={page.id}>
              <form action={savePage} className="grid gap-2">
                <input name="id" type="hidden" value={page.id} />
                <input
                  className="form-input"
                  name="title"
                  defaultValue={page.title}
                  required
                  maxLength={300}
                />
                <input
                  className="form-input"
                  name="url"
                  type="url"
                  defaultValue={page.url}
                  required
                  maxLength={2048}
                />
                <textarea
                  className="form-input min-h-16"
                  name="selectedText"
                  defaultValue={page.selected_text ?? ""}
                  maxLength={5000}
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="field-label flex-row items-center gap-2">
                    Collection
                    <select
                      className="form-input w-auto"
                      name="collection"
                      defaultValue={page.collection}
                    >
                      <option value="keep_forever">Keep forever</option>
                      <option value="read_later">Read later (30-day expiry)</option>
                    </select>
                  </label>
                  <div className="flex gap-2">
                    <button className="button-secondary" type="submit">
                      Update
                    </button>
                    <button
                      className="button-danger"
                      formAction={deletePage}
                      formNoValidate
                      type="submit"
                      name="id"
                      value={page.id}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </form>
              <p className="mt-2 text-xs text-slate-500">
                {page.collection === "read_later" && page.expires_at
                  ? `Read later · expires ${new Date(page.expires_at).toLocaleDateString()}`
                  : "Keep forever"}
              </p>
              <a
                className="mt-2 inline-block text-sm font-medium text-indigo-700 hover:underline"
                href={page.url}
                rel="noreferrer"
                target="_blank"
              >
                Open saved page
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
