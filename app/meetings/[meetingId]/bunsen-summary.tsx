import { toBunsenNotes, type BunsenNotes } from "@/lib/bunsen/types";

type SummaryRow = {
  summary_markdown: string;
  summary_json: unknown;
};

function BulletList({ items }: { items: string[] }) {
  if (!items.length) {
    return null;
  }
  return (
    <ul>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function BunsenSummary({ summary }: { summary: SummaryRow }) {
  const notes: BunsenNotes = toBunsenNotes(summary.summary_json);

  return (
    <div className="bunsen-summary">
      <details open className="bunsen-section">
        <summary>Overview</summary>
        <div className="bunsen-body">
          <p>{notes.overview || "No overview captured."}</p>
          {notes.client_context ? (
            <>
              <h3>Client Context</h3>
              <p>{notes.client_context}</p>
            </>
          ) : null}
        </div>
      </details>

      {notes.client_wants.length ? (
        <details className="bunsen-section">
          <summary>Client Wants</summary>
          <div className="bunsen-body">
            <BulletList items={notes.client_wants} />
          </div>
        </details>
      ) : null}

      {notes.action_items.length ? (
        <details className="bunsen-section">
          <summary>Action Items</summary>
          <div className="bunsen-body">
            <ul>
              {notes.action_items.map((item, i) => (
                <li key={`${item.task}-${i}`}>
                  {item.task}
                  {item.owner ? ` (${item.owner})` : ""}
                  {item.due ? ` due ${item.due}` : ""}
                </li>
              ))}
            </ul>
          </div>
        </details>
      ) : null}

      {notes.possible_solutions.length ? (
        <details className="bunsen-section">
          <summary>Possible Solutions</summary>
          <div className="bunsen-body">
            {notes.possible_solutions.map((s, i) => (
              <div className="solution-block" key={`${s.problem}-${i}`}>
                <p>
                  <strong>Problem:</strong> {s.problem}
                </p>
                <p>
                  <strong>Solution:</strong> {s.solution}
                </p>
                {s.tech_stack?.length ? (
                  <p className="tech-stack">
                    {s.tech_stack.map((tech) => (
                      <span className="chip" key={tech}>
                        {tech}
                      </span>
                    ))}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {notes.topics_discussed.length ? (
        <details className="bunsen-section">
          <summary>Topics Discussed</summary>
          <div className="bunsen-body">
            <ul>
              {notes.topics_discussed.map((t, i) => (
                <li key={`${t.topic}-${i}`}>
                  <strong>{t.topic}:</strong> {t.notes}
                </li>
              ))}
            </ul>
          </div>
        </details>
      ) : null}

      {notes.research.length ? (
        <details className="bunsen-section">
          <summary>Research</summary>
          <div className="bunsen-body">
            {notes.research.map((r, i) => (
              <div className="research-block" key={`${r.key_point}-${i}`}>
                <h3>{r.key_point}</h3>
                <p>{r.findings}</p>
                {r.sources.length ? (
                  <ul>
                    {r.sources.map((s) => (
                      <li key={s.url}>
                        <a href={s.url} target="_blank" rel="noreferrer">
                          {s.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {notes.jargon_breakdown.length ? (
        <details className="bunsen-section">
          <summary>Jargon Breakdown</summary>
          <div className="bunsen-body">
            <ul>
              {notes.jargon_breakdown.map((j, i) => (
                <li key={`${j.term}-${i}`}>
                  <strong>{j.term}:</strong> {j.plain_english}
                </li>
              ))}
            </ul>
          </div>
        </details>
      ) : null}

      {notes.visual_notes.length ? (
        <details className="bunsen-section">
          <summary>Visual Notes</summary>
          <div className="bunsen-body">
            <BulletList items={notes.visual_notes} />
          </div>
        </details>
      ) : null}

      {notes.follow_ups.length ? (
        <details className="bunsen-section">
          <summary>Follow-ups</summary>
          <div className="bunsen-body">
            <BulletList items={notes.follow_ups} />
          </div>
        </details>
      ) : null}

      {notes.decisions.length ? (
        <details className="bunsen-section">
          <summary>Decisions</summary>
          <div className="bunsen-body">
            <BulletList items={notes.decisions} />
          </div>
        </details>
      ) : null}

      {notes.risks.length ? (
        <details className="bunsen-section">
          <summary>Risks</summary>
          <div className="bunsen-body">
            <BulletList items={notes.risks} />
          </div>
        </details>
      ) : null}

      {notes.open_questions.length ? (
        <details className="bunsen-section">
          <summary>Open Questions</summary>
          <div className="bunsen-body">
            <BulletList items={notes.open_questions} />
          </div>
        </details>
      ) : null}

      <details className="bunsen-section">
        <summary>Raw markdown</summary>
        <div className="bunsen-body">
          <pre>{summary.summary_markdown}</pre>
        </div>
      </details>
    </div>
  );
}
