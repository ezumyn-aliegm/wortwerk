import React, { useState } from "react";
import { ArrowLeft, Blocks, Hammer, Check, Map } from "lucide-react";
import { BUILDINGS, freshGame, gameStatus } from "./game.js";
import island from "./assets/outpost-island.png";
import buildings from "./assets/outpost-buildings.png";
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

export function MissionHUD({ game, locked, onOpen, onBuild }) {
  game ||= freshGame();
  const status = gameStatus(game);
  const selected = status.selectedBuild;
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
            <span>{status.allBuilt ? "Keep your German skills growing." : `${status.nextNeeded} more blocks to build`}</span>
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
      {status.canBuild && !locked && <button className="build-action" onClick={() => onBuild(selected.id)}><Hammer />Build {selected.label.toLowerCase()}</button>}
      <button onClick={onOpen} className="outpost-link"><Map size={23} /><span>Explore & choose builds</span></button>
      <p className="mission-tip">Recall earns blocks. Spelling earns more. Mistakes never cost blocks.</p>
      </div>
    </aside>
  );
}

export default function Outpost({
  game,
  onSelect,
  onBuild,
  onContinue,
  checkpoint,
  active,
}) {
  game ||= freshGame();
  const status = gameStatus(game);
  const selected =
    BUILDINGS.find((b) => b.id === game.selected) || BUILDINGS[0];
  const built = game.built.includes(selected.id);
  const [announcement, setAnnouncement] = useState("");
  const canBuild = !built && status.availableBlocks >= selected.cost;
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
                : `Gather ${selected.cost - status.availableBlocks} more blocks`}
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
                {game.built.includes(b.id) ? "Built ✓" : `${b.cost} blocks`}
              </small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
