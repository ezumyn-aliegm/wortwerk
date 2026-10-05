import React, { useState } from "react";
import { ArrowLeft, Blocks, Hammer, Check, Map } from "lucide-react";
import { BUILDINGS, freshGame, gameStatus, buildRequirement } from "./game.js";
import island from "./assets/outpost-island.png";
import buildings from "./assets/outpost-buildings.png";
import VillageBuilding, { villageStage } from './VillageBuilding.jsx';
import "./outpost.css";

export function BuildingSprite({ id, className = "" }) {
  const index = BUILDINGS.findIndex((b) => b.id === id);
  return (
    <span
      aria-hidden="true"
      className={`building-sprite ${className}`}
      style={{
        backgroundImage: `url(${buildings})`,
        backgroundPosition: `${index * 25}% center`,
      }}
    />
  );
}

export function MissionHUD({ game, locked, onOpen, onBuild, learning }) {
  if (learning?.scoringVersion === 2) return <VillageView game={game} learning={learning} compact locked={locked} onOpen={onOpen} />;
  game ||= freshGame();
  const status = gameStatus(game);
  const selected = status.selectedBuild;
  const requirement = buildRequirement(selected.id, learning);
  return (
    <aside className="mission-hud" aria-label="Outpost mission">
      <div className="mission-world outpost-world" role="img" aria-label={`Your island: ${game.built.length} of ${BUILDINGS.length} buildings complete`}>
        <img className="outpost-island" src={island} alt="" />
        {game.built.map((id) => <BuildingSprite key={id} id={id} className={`world-building plot-${id}`} />)}
        {!status.allBuilt && <BuildingSprite id={selected.id} className={`world-building blueprint-ghost plot-${selected.id}`} />}
        <div className="mission-world-label">WORDCRAFT EXPEDITION <span>{game.built.length}/{BUILDINGS.length} built</span></div>
      </div>
      <div className="mission-inventory">
        <div className="mission-goal">
          <BuildingSprite id={selected.id} />
          <div><span className="quest-label">{status.allBuilt ? "Outpost complete" : "Your building quest"}</span>
            <h2>{status.allBuilt ? "A world you built." : selected.label}</h2>
            <span>{status.allBuilt ? "Keep your German skills growing." : requirement || `${status.nextNeeded} more blocks to build`}</span>
          </div>
        </div>
        <div className="mission-supplies">
          <strong className="block-balance"><Blocks size={25} />{status.availableBlocks} blocks</strong>
          {!status.allBuilt && <span>{selected.cost} needed</span>}
        </div>
        {!status.allBuilt && <progress className="build-meter" aria-label={`Blocks for ${selected.label}`} value={Math.min(status.availableBlocks, selected.cost)} max={selected.cost} />}
      <div className="mission-progress">
        <strong>
          {locked ? "Expedition challenge" : "Six answers. Then a building break."}
        </strong>
        {!locked && (
          <>
            <span
              className="mission-pips"
              aria-label={`${status.missionProgress} of 6 answers`}
            >
              {Array.from({ length: 6 }, (_, i) => (
                <i
                  key={i}
                  className={i < status.missionProgress ? "filled" : ""}
                />
              ))}
            </span>
            <span>{status.missionProgress}/6 answers</span>
          </>
        )}
        {locked && (
          <span>Rewards wait until after the check. No hints or timers.</span>
        )}
      </div>
      {status.canBuild && !locked && !requirement && <button className="build-action" onClick={() => onBuild(selected.id)}><Hammer />Build {selected.label.toLowerCase()}</button>}
      <button onClick={onOpen} className="outpost-link"><Map size={23} /><span>Explore & choose builds</span></button>
      <p className="mission-tip">Recall earns blocks. Spelling earns more. Mistakes never cost blocks.</p>
      </div>
    </aside>
  );
}

function LegacyOutpost({
  game,
  onSelect,
  onBuild,
  onContinue,
  checkpoint,
  active,
  learning,
}) {
  game ||= freshGame();
  const status = gameStatus(game);
  const selected =
    BUILDINGS.find((b) => b.id === game.selected) || BUILDINGS[0];
  const built = game.built.includes(selected.id);
  const [announcement, setAnnouncement] = useState("");
  const requirement = buildRequirement(selected.id, learning);
  const canBuild = !built && !requirement && status.availableBlocks >= selected.cost;
  return (
    <section className="outpost-screen" aria-label="Your outpost">
      <div className="outpost-main">
        <div
          className="outpost-world"
          role="img"
          aria-label={`Your forest outpost. ${game.built.length ? game.built.map((id) => BUILDINGS.find((b) => b.id === id).label).join(", ") + " built." : "An empty island ready to build."}`}
        >
          <img className="outpost-island" src={island} alt="" />
          {game.built.map((id) => (
            <BuildingSprite
              key={id}
              id={id}
              className={`world-building plot-${id}`}
            />
          ))}
          {!built && (
            <BuildingSprite
              id={selected.id}
              className={`world-building blueprint-ghost plot-${selected.id}`}
            />
          )}
          <div className="world-caption">
            <strong>Your outpost</strong>
            <span>
              {game.built.length} of {BUILDINGS.length} builds complete
            </span>
          </div>
        </div>
        <div className="outpost-workbench">
          <h1>
            {game.built.length === BUILDINGS.length
              ? "You built a world."
              : game.built.length
                ? "What will you build next?"
                : "Build your first shelter."}
          </h1>
          <p className="outpost-intro">
            Remember words. Gather blocks. Make this place yours.
          </p>
          {checkpoint && (
            <p className="mission-done">
              Mission complete. Take a building break.
            </p>
          )}
          <div className="outpost-resources">
            <Blocks aria-hidden="true" size={34} />
            <strong>{status.availableBlocks} blocks ready</strong>
          </div>
          <div className="selected-blueprint">
            <BuildingSprite id={selected.id} />
            <div>
              <h2>{selected.label}</h2>
              <p>{selected.description}</p>
              <strong>
                {selected.cost} blocks{built ? " · Built" : ""}
              </strong>
            </div>
          </div>
          <button
            className="build-action"
            disabled={!canBuild}
            onClick={() => {
              onBuild(selected.id);
              setAnnouncement(
                `${selected.label} built! It’s part of your world now.`,
              );
            }}
          >
            {built ? <Check /> : <Hammer />}
            {built
              ? "Built — yours to keep"
              : canBuild
                ? `Build ${selected.label.toLowerCase()}`
                : requirement || `Gather ${selected.cost - status.availableBlocks} more blocks`}
          </button>
          <button className="mission-return" onClick={onContinue}>
            <ArrowLeft />
            {active ? "Back to my mission" : "Start my next mission"}
          </button>
          <p className="build-announcement" role="status">
            {announcement}
          </p>
          <details className="outpost-rules">
            <summary>How do I earn blocks?</summary>
            <p>
              Remember a meaning: 1 block. Spell a word, use it in a sentence,
              or recall its form: 2 blocks. Each word and skill can pay twice. A
              comeback after a mistake can earn one extra block. Hints and
              copied answers help you learn but don’t earn blocks. Nothing is
              lost for a mistake.
            </p>
            <p>
              Buildings are rewards, not test scores. Learning progress is
              tracked separately. No countdowns, lives, or daily streaks to
              lose.
            </p>
          </details>
        </div>
      </div>
      <div className="blueprint-queue">
        <div>
          <h2>Blueprint queue</h2>
          <p>Choose what to build next.</p>
        </div>
        {BUILDINGS.map((b) => (
          <button
            key={b.id}
            onClick={() => {
              onSelect(b.id);
              setAnnouncement("");
            }}
            aria-pressed={selected.id === b.id}
            className="blueprint-choice"
          >
            <BuildingSprite id={b.id} />
            <span>
              <strong>{b.label}</strong>
              <small>
                {game.built.includes(b.id) ? "Built ✓" : buildRequirement(b.id, learning) || `${b.cost} blocks`}
              </small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function VillageView({ game, learning, compact, locked, checkpoint, onOpen, onContinue, active, onPractice, onWorkshop }) {
  const status = gameStatus(game);
  return <section className={compact ? 'mission-hud village-v2' : 'outpost-screen village-v2'} aria-label="Learning village">
    <div className={compact ? '' : 'outpost-main'}>
      <div className="outpost-world village-world" role="group" aria-label={`Learning and village: ${learning.percent} percent. ${BUILDINGS.map((b) => `${b.label} level ${status.levels[b.id]}`).join(', ')}`}>
        <img className="outpost-island" src={island} alt="" />
        {BUILDINGS.map((b) => <VillageBuilding key={b.id} id={b.id} currentLevel={status.levels[b.id]} historicalLevel={status.historicalLevels[b.id]} className={`world-building plot-${b.id}`} />)}
      </div>
      <div className={compact ? 'mission-inventory' : 'outpost-workbench'}>
        <div className="world-caption"><strong>{learning.percent}% learned · {learning.percent}% built</strong><span>{status.allBuilt ? 'All targets verified · portal active' : 'Independent recall builds automatically'}</span></div>
        <h2>{status.allBuilt ? 'Your village is complete.' : `${status.selectedBuild.label}: next upgrade at ${status.nextThreshold}%`}</h2>
        {!status.allBuilt && <progress className="build-meter" aria-label="Next four percent construction segment" value={status.segmentProgress} max="4" />}
        <p>{locked ? 'Inspection in progress. Answers stay hidden until the end.' : `${status.missionProgress}/6 planned challenges · ${status.independentSuccesses} independent successes · ${learning.repairs.length} repairs queued`}</p>
        {checkpoint && <p className="mission-done">Mission finished: {status.independentSuccesses} independent successes, {learning.repairs.length} repairs queued.</p>}
        {learning.repairs.length > 0 && <div className="village-repairs"><strong>Repair workbench</strong><ul>{learning.repairs.map((key) => <li key={key}>{key.replace('/', ': ').replace('usage:', 'sentence ').replace('form:', 'form ')}</li>)}</ul></div>}
        {Number.isFinite(learning.nextDelayedAt) && <p>Next delayed spelling check: {new Date(learning.nextDelayedAt).toLocaleString()} (eight hours after exposure).</p>}
        {compact ? <button className="outpost-link" onClick={onOpen}><Map />Explore village</button> : <>
          <button className="mission-return" onClick={onContinue}><ArrowLeft />{active ? 'Continue mission' : 'Recommended mission'}</button>
          {!active && !learning.initialComplete && <div className="village-mission-choices"><button onClick={onPractice}>Spelling expedition</button><button onClick={onWorkshop}>Sentence workshop</button></div>}
        </>}
        <p className="mission-tip">Guided work prepares you. Later independent recall earns evidence. A miss removes at most one step from that target; outlines preserve your previous milestones.</p>
      </div>
    </div>
    {!compact && <div className="blueprint-queue">{BUILDINGS.map((b) => <div className="blueprint-choice" key={b.id}><VillageBuilding id={b.id} currentLevel={status.levels[b.id]} historicalLevel={status.historicalLevels[b.id]} /><span><strong>{b.label}: {status.levels[b.id]}/5</strong><small>{villageStage(b.id,status.levels[b.id])}</small>{status.historicalLevels[b.id] > status.levels[b.id] && <small>Outline: previously level {status.historicalLevels[b.id]}</small>}</span></div>)}</div>}
  </section>;
}

export default function Outpost(props) {
  return props.learning?.scoringVersion === 2 ? <VillageView {...props} /> : <LegacyOutpost {...props} />;
}
