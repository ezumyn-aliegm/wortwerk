import React, { useMemo, useState } from "react";
import {
  activityStats,
  ACTIVITY_TIME_ZONE,
  validateActivity,
} from "./activity.js";
import { createTutor } from "./tutor.js";
import { sessionAccuracy } from './answer-feedback.js';
import "./parent.css";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: ACTIVITY_TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: ACTIVITY_TIME_ZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const dateTime = (at) =>
  Number.isFinite(at) && at >= 0 ? timeFormat.format(at) : "Not recorded";
const percent = (value) =>
  value === null ? "—" : `${Math.round(value * 100)}%`;
const duration = (seconds) => {
  if (seconds === 0) return "0 sec";
  if (seconds < 1) return "<1 sec";
  const whole = Math.floor(seconds);
  if (whole < 60) return `${whole} sec`;
  const minutes = Math.floor(whole / 60);
  return minutes < 60
    ? `${minutes} min ${whole % 60} sec`
    : `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
};
const skillNames = {
  meaning: "Meaning",
  spelling: "Spelling",
  usage: "Sentence use",
  form: "Word forms",
};

function Metric({ label, value, note }) {
  return (
    <div className="parent-metric">
      <dt>{label}</dt>
      <dd>{value}</dd>
      {note && <p>{note}</p>}
    </div>
  );
}

function WaveReadiness({ wave, now }) {
  const view = useMemo(() => {
    try {
      const tutor = createTutor(wave.words, { deadlineAt: wave.dueAt });
      const progress = wave.progress;
      const exams = progress.sessions.filter(
        (session) => session.kind === "exam",
      );
      return {
        summary: tutor.summary(progress),
        exam: exams.reduce(
          (latest, exam) =>
            !latest || exam.finishedAt > latest.finishedAt ? exam : latest,
          null,
        ),
        nextPhase: tutor.phaseInfo(
          progress.active && !tutor.scoringV2 ? { phase: progress.active.phase } : progress,
        ),
        availableAt: tutor.dueAt(progress),
        weak: wave.words
          .map((word) => ({ word, ...tutor.mastery(wave.progress, word.id) }))
          .filter((word) => !word.ready)
          .sort((a, b) => a.percent - b.percent)
          .slice(0, 8),
      };
    } catch {
      return null;
    }
  }, [wave]);
  const deadlineKnown = Number.isFinite(wave.dueAt) && wave.dueAt >= 0;
  const remaining = view ? wave.words.length - view.summary.ready : 0;
  const complete = view && (view.summary.scoringVersion === 2 ? view.summary.complete : remaining === 0 && wave.progress.phase >= 7);
  const nextTitle =
    view &&
    (wave.progress.active?.kind === "exam"
      ? "Final rehearsal"
      : wave.progress.active?.kind === "extra"
        ? "Targeted practice"
        : view.nextPhase.title);
  return (
    <article className="parent-wave">
      <div className="parent-section-heading">
        <h3>{wave.title}</h3>
        <span className="parent-pill">
          {deadlineKnown
            ? wave.dueAt < now
              ? "Deadline passed"
              : "Upcoming deadline"
            : "No deadline recorded"}
        </span>
      </div>
      {deadlineKnown && (
        <p className="parent-muted">Due {dateTime(wave.dueAt)} · Miami</p>
      )}
      {view ? (
        <>
          <p className="parent-readiness">
            <strong>
              {view.summary.ready} / {wave.words.length}
            </strong>{" "}
            words remembered
          </p>
          <progress
            max="100"
            value={view.summary.percent}
            aria-label={`${wave.title}: ${view.summary.percent}% mastery`}
          />
          <p className="parent-muted">
            {view.summary.percent}% mastery · {view.summary.introduced}{" "}
            introduced. “Remembered” includes successful recall after a gap.
          </p>
          <div className="parent-practice-next">
            <h4>Recommended next practice</h4>
            <p>
              {complete ? (
                "All course stages are complete. A short review can keep these words fresh."
              ) : (
                <>
                  <strong>
                    {wave.progress.active ? "Resume: " : "Next: "}
                    {nextTitle}
                  </strong>
                  {wave.progress.active
                    ? ". Continue the saved session."
                    : ` · About ${view.nextPhase.minutes} minutes.`}
                </>
              )}
            </p>
            {!complete && (
              <p className="parent-muted">
                {remaining}{" "}
                {remaining === 1 ? "word still needs" : "words still need"}{" "}
                secure recall
                {view.summary.scoringVersion === 2 ? ". Each target and the final checks must be completed"
                  : wave.progress.phase < 7
                  ? ` · ${7 - wave.progress.phase} course ${7 - wave.progress.phase === 1 ? "stage" : "stages"} remaining`
                  : ". Follow-up practice focuses on the remaining words"}
                .
              </p>
            )}
            {!complete && !wave.progress.active && view.availableAt > now && (
              <p className="parent-muted">
                The next scheduled session is available{" "}
                {dateTime(view.availableAt)}. The gap gives recall a chance to
                settle.
              </p>
            )}
          </div>
          <h4>Latest final rehearsal</h4>
          {view.exam ? (
            <>
              <p>
                <strong>{sessionAccuracy(view.exam).unaidedPercent}%</strong> · {sessionAccuracy(view.exam).unaidedCorrect} /{" "}
                {view.exam.count} answers correct without help
              </p>
              <p className="parent-muted">
                Completed {dateTime(view.exam.finishedAt)} · Miami
              </p>
              {view.exam.preparationAdded && (
                <p className="parent-muted">
                  Supported practice: missing lessons were taught before this
                  check. This was not a fully independent rehearsal.
                </p>
              )}
            </>
          ) : (
            <p className="parent-muted">
              No completed final rehearsal recorded.
            </p>
          )}
          <h4>Words needing attention now</h4>
          {view.weak.length ? (
            <ul className="parent-weak-words">
              {view.weak.map((word) => (
                <li key={word.word.id}>
                  <strong lang="de">{word.word.german}</strong>
                  <span>
                    {word.label} · {word.percent}%
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>All words meet the tutor’s recall criteria.</p>
          )}
          {wave.words.length - view.summary.ready > 8 && (
            <p className="parent-muted">
              Showing the eight words with the lowest mastery.
            </p>
          )}
        </>
      ) : (
        <p role="status">
          Readiness is unavailable for this wave’s saved progress.
        </p>
      )}
    </article>
  );
}

export function ParentDashboard({
  library,
  now = Date.now(),
  lastSyncedAt,
  onClose,
}) {
  const [range, setRange] = useState("today");
  const [selectedWave, setSelectedWave] = useState("");
  const waves = Array.isArray(library?.waves) ? library.waves : [];
  const waveId = waves.some((w) => w.id === selectedWave) ? selectedWave : "";
  const valid = useMemo(
    () => validateActivity(library?.activity, library?.waves),
    [library],
  );
  const stats = useMemo(
    () =>
      valid
        ? activityStats(library.activity, {
            now,
            range,
            waveId: waveId || undefined,
          })
        : null,
    [valid, library, now, range, waveId],
  );
  const titleFor = (id) =>
    waves.find((w) => w.id === id)?.title ?? "Unknown wave";
  const wordFor = (wave, word) =>
    waves.find((w) => w.id === wave)?.words.find((w) => w.id === word)
      ?.german ?? word;
  const visibleWaves = waves.filter((wave) => !waveId || wave.id === waveId);
  const syncKnown = Number.isFinite(lastSyncedAt) && lastSyncedAt >= 0;

  return (
    <main className="parent-dashboard" aria-labelledby="parent-title">
      <header className="parent-header">
        <div>
          <p className="parent-eyebrow">Wortwerk · Parent view</p>
          <h1 id="parent-title">Practice, in perspective</h1>
          <p>Recorded effort and current recall, together.</p>
        </div>
        {onClose && (
          <button type="button" className="parent-close" onClick={onClose}>
            Back to learning
          </button>
        )}
      </header>
      <p className="parent-sync">
        {syncKnown
          ? `Last successful sync: ${dateTime(lastSyncedAt)} · Miami.`
          : "Last successful sync: unknown. These figures reflect the library currently loaded."}
      </p>
      <p className="parent-tracking-summary">
        Active time is an estimate that excludes paused, hidden, and idle time.
        No cameras or microphones are used. Practice history before tracking
        began is unavailable.
      </p>
      <section className="parent-filters" aria-label="Activity filters">
        <fieldset>
          <legend>Practice period</legend>
          <div className="parent-ranges">
            {[
              ["today", "Today"],
              ["week", "This week"],
              ["all", "All time"],
            ].map(([id, label]) => (
              <button
                type="button"
                key={id}
                aria-pressed={range === id}
                onClick={() => setRange(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="parent-wave-filter">
          Word wave
          <select
            value={waveId}
            onChange={(e) => setSelectedWave(e.target.value)}
          >
            <option value="">All waves</option>
            {waves.map((wave) => (
              <option key={wave.id} value={wave.id}>
                {wave.title}
              </option>
            ))}
          </select>
        </label>
        <p className="parent-muted">Miami time · Weeks begin Monday.</p>
      </section>
      {!stats ? (
        <section className="parent-card" role="status">
          <h2>Activity is unavailable</h2>
          <p>
            The saved activity record is missing or invalid. No practice totals
            have been inferred from tutor progress.
          </p>
        </section>
      ) : (
        <>
          <section
            className="parent-card"
            aria-labelledby="parent-activity-title"
          >
            <div className="parent-section-heading">
              <h2 id="parent-activity-title">
                {range === "today"
                  ? "Today’s practice"
                  : range === "week"
                    ? "This week’s practice"
                    : "All recorded practice"}
              </h2>
              <span className="parent-pill">
                {waveId ? titleFor(waveId) : "All waves"}
              </span>
            </div>
            {stats.rangeIncomplete && (
              <p className="parent-notice">
                This period is only partially recorded. Available daily detail
                begins {stats.detailSince}.
              </p>
            )}
            <dl className="parent-metrics">
              <Metric
                label="Practice visits"
                value={stats.totals.visits}
                note="Started with engagement or an answer"
              />
              <Metric
                label="Active practice time"
                value={duration(stats.totals.activeSeconds)}
                note="Estimated from active practice"
              />
              <Metric
                label="Questions answered"
                value={stats.totals.answers}
                note="Answer submissions, including retries"
              />
              <Metric
                label="First-try accuracy"
                value={percent(stats.firstTryAccuracy)}
                note={
                  stats.totals.firstTries
                    ? `${stats.totals.firstTryCorrect} unassisted correct / ${stats.totals.firstTries} first tries`
                    : "No first tries recorded"
                }
              />
              <Metric
                label="Practice days"
                value={stats.daysActive}
                note="Days with recorded activity"
              />
              <Metric
                label="Last activity"
                value={
                  stats.totals.lastAt === null
                    ? "None recorded"
                    : dateTime(stats.totals.lastAt)
                }
                note="Within the selected period and wave"
              />
            </dl>
            <p className="parent-explanation">
              {stats.totals.retries} retry answers · {stats.totals.assisted}{" "}
              assisted answers
              {stats.totals.unknownRetries > 0
                ? ` · ${stats.totals.unknownRetries} answers with unknown attempt number`
                : ""}
              . Retries and assisted answers do not improve first-try accuracy.
            </p>
            <h3>Practice by skill</h3>
            <div className="parent-table-scroll">
              <table>
                <caption className="parent-sr-only">
                  Skill activity for the selected period and wave
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Skill</th>
                    <th scope="col">Answers</th>
                    <th scope="col">First-try accuracy</th>
                    <th scope="col">Retries</th>
                    <th scope="col">Assisted</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(skillNames).map(([type, label]) => {
                    const s = stats.skills[type];
                    return (
                      <tr key={type}>
                        <th scope="row">{label}</th>
                        <td>{s.answers}</td>
                        <td>
                          {percent(
                            s.firstTries
                              ? s.firstTryCorrect / s.firstTries
                              : null,
                          )}{" "}
                          <span className="parent-muted">
                            ({s.firstTryCorrect}/{s.firstTries})
                          </span>
                        </td>
                        <td>{s.retries}</td>
                        <td>{s.assisted}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
          <section
            className="parent-card"
            aria-labelledby="parent-visits-title"
          >
            <h2 id="parent-visits-title">Recent practice visits</h2>
            <p className="parent-muted">
              Up to 100 retained visits. Time and answers below use the selected
              period and wave; the start time is the visit’s original start.
            </p>
            {stats.visits.length ? (
              <div className="parent-table-scroll">
                <table>
                  <caption className="parent-sr-only">Recorded visits</caption>
                  <thead>
                    <tr>
                      <th scope="col">Visit started</th>
                      <th scope="col">Wave</th>
                      <th scope="col">Active time</th>
                      <th scope="col">Answers</th>
                      <th scope="col">First tries</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.visits.map((visit) => (
                      <tr key={visit.sessionId}>
                        <th scope="row">
                          {dateTime(visit.startedAt)}
                          {visit.truncated && (
                            <span className="parent-muted parent-block">
                              Partial history
                            </span>
                          )}
                        </th>
                        <td>{visit.waveIds.map(titleFor).join(", ")}</td>
                        <td>{duration(visit.totals.activeSeconds)}</td>
                        <td>{visit.totals.answers}</td>
                        <td>
                          {visit.totals.firstTryCorrect}/
                          {visit.totals.firstTries} unassisted correct
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="parent-empty">
                No retained visits match these filters.
              </p>
            )}
          </section>
          <section
            className="parent-card"
            aria-labelledby="parent-errors-title"
          >
            <h2 id="parent-errors-title">Spelling to revisit</h2>
            <p className="parent-muted">
              Retained mistakes in this period and wave, with repeated examples
              grouped. These are past answers, not a measure of current mastery.
            </p>
            {stats.spellingErrors.length ? (
              <div className="parent-table-scroll">
                <table>
                  <caption className="parent-sr-only">
                    Spelling mistakes
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Word / wave</th>
                      <th scope="col">Entered</th>
                      <th scope="col">Expected</th>
                      <th scope="col">Occurrences</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.spellingErrors.map((error) => (
                      <tr
                        key={JSON.stringify([
                          error.waveId,
                          error.wordId,
                          error.input,
                          error.expected,
                        ])}
                      >
                        <th scope="row">
                          <span lang="de">
                            {wordFor(error.waveId, error.wordId)}
                          </span>
                          <span className="parent-muted parent-block">
                            {titleFor(error.waveId)}
                          </span>
                        </th>
                        <td lang="de" className="parent-answer">
                          {error.input || "(empty answer)"}
                        </td>
                        <td lang="de" className="parent-answer">
                          {error.expected || "Not recorded"}
                        </td>
                        <td>{error.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="parent-empty">
                No retained spelling mistakes match these filters.
              </p>
            )}
          </section>
          <details className="parent-retention">
            <summary>How tracking works</summary>
            <p>
              Tracking began {dateFormat.format(stats.startedAt)}. Practice
              visits and active time before tracking began are unrecorded.
              Existing mastery can include earlier learning.
            </p>
            <p>
              Visits count once when they begin; a visit spanning midnight can
              add time on a later day without starting another visit. A visit
              used in two waves counts once in each wave, once overall. Assisted
              answers can also be retries.
            </p>
            <p>
              All-time totals cover activity since tracking began. Daily detail
              keeps up to 365 Miami dates; visit history keeps up to 100 visits,
              with up to 32 date/wave entries each. Spelling history keeps up to
              100 daily example groups, with each answer shortened to 160
              characters. Repeated counts cover retained examples only. A
              storage limit can shorten these histories; the current daily
              detail window begins {stats.detailSince}.
            </p>
            <p>
              Duplicate protection covers the latest 2,048 recorded events and
              1,024 visit identities. The app reports active time in segments of
              at most 15 seconds; time without an engaged visit is ignored.
              Totals are not an estimate of earlier practice or a guarantee of
              exam performance.
            </p>
          </details>
        </>
      )}
      <section className="parent-card" aria-labelledby="parent-readiness-title">
        <h2 id="parent-readiness-title">Current readiness & deadlines</h2>
        <p className="parent-muted">
          Current progress, next practice, and latest rehearsal for the selected
          waves, independent of the practice-period filter.
        </p>
        <div className="parent-wave-grid">
          {visibleWaves.map((wave) => (
            <WaveReadiness key={wave.id} wave={wave} now={now} />
          ))}
        </div>
        {!visibleWaves.length && (
          <p className="parent-empty">No word waves are available.</p>
        )}
      </section>
    </main>
  );
}

export default ParentDashboard;
