/**
 * Naruto RPG Combat Document
 * Manages the two-phase combat system (selection and execution)
 * @author Kirlian Silvestre
 * @extends {Combat}
 */

import {
  COMBAT_PHASE,
  SELECTION_STATUS,
  ACTION_STATUS,
  FLAG_SCOPE,
  COMBAT_FLAGS,
  COMBATANT_FLAGS,
  SF_HOOKS,
  getDefaultCombatFlags,
  getDefaultCombatantFlags,
  sortByInitiative
} from "./combat-phases.mjs";

import {
  broadcastPhaseChanged,
  broadcastTurnStarted,
  broadcastInterruption
} from "./combat-socket.mjs";

export class NarutoRpgCombat extends Combat {

  /* -------------------------------------------- */
  /*  Accessors                                   */
  /* -------------------------------------------- */

  /**
   * Get the current combat phase
   * @returns {string}
   */
  get phase() {
    return this.getFlag(FLAG_SCOPE, COMBAT_FLAGS.PHASE) ?? COMBAT_PHASE.SETUP;
  }

  /**
   * Get the currently acting combatant ID
   * @returns {string|null}
   */
  get currentActingCombatantId() {
    return this.getFlag(FLAG_SCOPE, COMBAT_FLAGS.CURRENT_ACTING_ID) ?? null;
  }

  /**
   * Get the currently acting combatant
   * @returns {Combatant|null}
   */
  get currentActingCombatant() {
    const id = this.currentActingCombatantId;
    return id ? this.combatants.get(id) : null;
  }

  /**
   * Get the interruption stack
   * @returns {string[]}
   */
  get interruptionStack() {
    return this.getFlag(FLAG_SCOPE, COMBAT_FLAGS.INTERRUPTION_STACK) ?? [];
  }

  /**
   * Check if the turn has been started by GM
   * @returns {boolean}
   */
  get turnStarted() {
    return this.getFlag(FLAG_SCOPE, COMBAT_FLAGS.TURN_STARTED) ?? false;
  }

  /**
   * Check if all combatants have selected their maneuvers
   * @returns {boolean}
   */
  get allSelectionsComplete() {
    if (!this.combatants?.size) return false;
    return Array.from(this.combatants).every(c => {
      if (c.isDefeated) return true;
      const status = c.getFlag(FLAG_SCOPE, COMBATANT_FLAGS.SELECTION_STATUS);
      return status === SELECTION_STATUS.READY;
    });
  }

  /**
   * Check if all combatants have completed their actions
   * @returns {boolean}
   */
  get allActionsComplete() {
    if (!this.combatants?.size) return false;
    return Array.from(this.combatants).every(c => {
      if (c.isDefeated) return true;
      const status = c.getFlag(FLAG_SCOPE, COMBATANT_FLAGS.ACTION_STATUS);
      return status === ACTION_STATUS.COMPLETED || status === ACTION_STATUS.SKIPPED;
    });
  }

  /**
   * Get combatants sorted by initiative (speed-based with tiebreaker)
   * @returns {Combatant[]}
   */
  get combatantsByInitiative() {
    if (!this.combatants?.size) return [];
    const combatantsWithSpeed = Array.from(this.combatants)
      .filter(c => !c.isDefeated)
      .map(c => ({
        combatant: c,
        speed: c.selectedManeuverSpeed ?? 999,
        speedTiebreaker: c.selectedManeuverSpeedTiebreaker ?? 999,
        name: c.name
      }));

    return sortByInitiative(combatantsWithSpeed).map(item => item.combatant);
  }

  /* -------------------------------------------- */
  /*  Lifecycle Methods                           */
  /* -------------------------------------------- */

  /** @override */
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);

    const flags = getDefaultCombatFlags();
    this.updateSource({ [`flags.${FLAG_SCOPE}`]: flags });
  }

  /** @override */
  async startCombat() {
    await this._resetSuperBars();
    await this._initializeCombatFlags();
    return super.startCombat();
  }

  /**
   * Return the Array of combatants sorted into initiative order.
   * During execution phase, sorts by maneuver speed (lower = faster = first).
   * @override
   * @returns {Combatant[]}
   */
  setupTurns() {
    this.turns ||= [];

    // Get phase from flags (safely, as this may be called during initialization)
    const phase = this.flags?.[FLAG_SCOPE]?.[COMBAT_FLAGS.PHASE];

    // Determine the turn order based on phase
    let turns;
    if (phase === COMBAT_PHASE.EXECUTION) {
      // During execution phase, sort by maneuver speed tiebreaker (lower = faster = first)
      // speedTiebreaker includes wits, perception, and random roll for tiebreaking
      turns = this.combatants.contents.sort((a, b) => {
        const tiebreakerA = a.selectedManeuverSpeedTiebreaker ?? 999;
        const tiebreakerB = b.selectedManeuverSpeedTiebreaker ?? 999;
        return tiebreakerA - tiebreakerB;
      });
    } else {
      // Default Foundry sorting (by initiative, descending)
      turns = this.combatants.contents.sort((a, b) => {
        const ia = Number.isNumeric(a.initiative) ? a.initiative : -Infinity;
        const ib = Number.isNumeric(b.initiative) ? b.initiative : -Infinity;
        return (ib - ia) || (a.id > b.id ? 1 : -1);
      });
    }

    // Handle turn index bounds
    if (this.turn !== null) {
      if (this.turn < 0) this.turn = 0;
      else if (this.turn >= turns.length) {
        this.turn = 0;
        this.round++;
      }
    }

    // Update state tracking
    const c = turns[this.turn];
    this.current = this._getCurrentState(c);

    // One-time initialization of the previous state
    if (!this.previous) this.previous = this.current;

    // Return the array of prepared turns
    return this.turns = turns;
  }

  /* -------------------------------------------- */
  /*  Phase Management                            */
  /* -------------------------------------------- */

  /**
   * Initialize combat flags for a new combat
   * @private
   */
  async _initializeCombatFlags() {
    const flags = getDefaultCombatFlags();
    await this.update({ [`flags.${FLAG_SCOPE}`]: flags });

    for (const combatant of this.combatants) {
      await combatant.initializeFlags();
    }
  }

  /**
   * Start the selection phase (GM action)
   * @returns {Promise<Combat>}
   */
  async startSelectionPhase() {
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Combat.OnlyGMCanStartTurn"));
      return this;
    }

    const previousPhase = this.phase;

    // Increment round if this is a new turn (round 0 means combat just started)
    if (this.round === 0) {
      await this.update({ round: 1 });
    }

    await this._resetCombatantFlags();

    await this.setFlag(FLAG_SCOPE, COMBAT_FLAGS.PHASE, COMBAT_PHASE.SELECTION);
    await this.setFlag(FLAG_SCOPE, COMBAT_FLAGS.TURN_STARTED, true);
    await this.setFlag(FLAG_SCOPE, COMBAT_FLAGS.CURRENT_ACTING_ID, null);
    await this.setFlag(FLAG_SCOPE, COMBAT_FLAGS.INTERRUPTION_STACK, []);

    // Dispatch Foundry lifecycle hook for round start
    const roundContext = { round: this.round, skipped: false };
    await this._onStartRound(roundContext);

    // Dispatch Naruto RPG specific phase changed hook
    Hooks.callAll(SF_HOOKS.PHASE_CHANGED, this, COMBAT_PHASE.SELECTION, previousPhase);

    broadcastPhaseChanged(this, COMBAT_PHASE.SELECTION);

    ui.notifications.info(game.i18n.localize("NARUTO_RPG.Combat.SelectionPhaseStarted"));

    return this;
  }

  /**
   * Start the execution phase (GM action)
   * @returns {Promise<Combat>}
   */
  async startExecutionPhase() {
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Combat.OnlyGMCanStartExecution"));
      return this;
    }

    if (!this.allSelectionsComplete) {
      ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Combat.NotAllSelectionsComplete"));
      return this;
    }

    const previousPhase = this.phase;

    // Pre-calculate the first combatant before changing phase
    // This ensures currentActingId is set atomically with the phase change
    const combatantsWithSpeed = Array.from(this.combatants)
      .filter(c => !c.isDefeated)
      .map(c => ({
        combatant: c,
        speed: c.selectedManeuverSpeed ?? 999,
        speedTiebreaker: c.selectedManeuverSpeedTiebreaker ?? 999,
        name: c.name
      }));
    const sortedCombatants = sortByInitiative(combatantsWithSpeed).map(item => item.combatant);
    const firstCombatant = sortedCombatants[0];

    // Set phase and first acting combatant atomically to avoid race conditions
    await this.update({
      [`flags.${FLAG_SCOPE}.${COMBAT_FLAGS.PHASE}`]: COMBAT_PHASE.EXECUTION,
      [`flags.${FLAG_SCOPE}.${COMBAT_FLAGS.CURRENT_ACTING_ID}`]: firstCombatant?.id ?? null
    });

    // Re-sort turns by speed now that we're in execution phase
    this.setupTurns();

    // Dispatch Naruto RPG specific phase changed hook
    Hooks.callAll(SF_HOOKS.PHASE_CHANGED, this, COMBAT_PHASE.EXECUTION, previousPhase);

    // Set the first combatant as acting (handles turn sync and hooks)
    if (firstCombatant) {
      await firstCombatant.setFlag(FLAG_SCOPE, COMBATANT_FLAGS.ACTION_STATUS, ACTION_STATUS.ACTING);

      // Sync Foundry's turn property
      const turnIndex = this.turns.findIndex(c => c.id === firstCombatant.id);
      if (turnIndex >= 0 && turnIndex !== this.turn) {
        await this.update({ turn: turnIndex }, { turnEvents: false });
      }

      // Dispatch start turn event
      const startContext = { round: this.round, turn: turnIndex, skipped: false };
      await this._onStartTurn(firstCombatant, startContext);

      // Dispatch standard Foundry hooks for module compatibility
      const updateData = { round: this.round, turn: turnIndex };
      const updateOptions = { direction: 1 };
      Hooks.callAll("combatTurn", this, updateData, updateOptions);
      Hooks.callAll("combatTurnChange", this, this.previous, this.current);

      broadcastTurnStarted(this, firstCombatant);
    }

    broadcastPhaseChanged(this, COMBAT_PHASE.EXECUTION);

    ui.notifications.info(game.i18n.localize("NARUTO_RPG.Combat.ExecutionPhaseStarted"));

    return this;
  }

  /**
   * Advance to the next turn (new round)
   * @returns {Promise<Combat>}
   */
  async advanceToNextTurn() {
    if (!game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Combat.OnlyGMCanAdvanceTurn"));
      return this;
    }

    if (!this.allActionsComplete) {
      ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Combat.NotAllActionsComplete"));
      return this;
    }

    // Dispatch Foundry lifecycle hook for round end
    const roundContext = { round: this.round, skipped: false };
    await this._onEndRound(roundContext);

    await this.nextRound();
    await this.startSelectionPhase();

    return this;
  }

  /* -------------------------------------------- */
  /*  Action Management                           */
  /* -------------------------------------------- */

  /**
   * Set the currently acting combatant
   * Synchronizes with Foundry's combat.turn and dispatches standard hooks for module compatibility
   * @param {Combatant} combatant - The combatant to set as acting
   * @private
   */
  async _setActingCombatant(combatant) {
    const previousActing = this.currentActingCombatant;
    const previousTurn = this.turn;

    // Handle previous combatant's turn ending (if interrupted)
    if (previousActing && previousActing.id !== combatant.id) {
      const prevStatus = previousActing.getFlag(FLAG_SCOPE, COMBATANT_FLAGS.ACTION_STATUS);
      if (prevStatus === ACTION_STATUS.ACTING || prevStatus === ACTION_STATUS.REVEALED) {
        await previousActing.setFlag(FLAG_SCOPE, COMBATANT_FLAGS.ACTION_STATUS, ACTION_STATUS.INTERRUPTED);

        // Dispatch end turn event for the interrupted combatant
        const endContext = { round: this.round, turn: previousTurn, skipped: false };
        await this._onEndTurn(previousActing, endContext);
      }
    }

    // Calculate turn index based on Foundry's turns array for compatibility
    // Note: this.turns is Foundry's internal turn order, not our speed-based order
    const turnIndex = this.turns.findIndex(c => c.id === combatant.id);

    // Update both: Naruto RPG flag AND Foundry's standard turn property
    await this.setFlag(FLAG_SCOPE, COMBAT_FLAGS.CURRENT_ACTING_ID, combatant.id);
    await combatant.setFlag(FLAG_SCOPE, COMBATANT_FLAGS.ACTION_STATUS, ACTION_STATUS.ACTING);

    // Sync Foundry's turn property (turnEvents: false to prevent Foundry's own event dispatch)
    if (turnIndex >= 0 && turnIndex !== this.turn) {
      await this.update({ turn: turnIndex }, { turnEvents: false });
    }

    // Dispatch start turn event for the new combatant
    const startContext = { round: this.round, turn: turnIndex, skipped: false };
    await this._onStartTurn(combatant, startContext);

    // Dispatch standard Foundry hooks for module compatibility
    const updateData = { round: this.round, turn: turnIndex };
    const updateOptions = { direction: 1 };
    Hooks.callAll("combatTurn", this, updateData, updateOptions);
    Hooks.callAll("combatTurnChange", this, this.previous, this.current);

    broadcastTurnStarted(this, combatant);
  }

  /**
   * Handle interruption by a combatant
   * @param {string} interruptorId - ID of the interrupting combatant
   * @returns {Promise<Combat>}
   */
  async handleInterruption(interruptorId) {
    const interruptor = this.combatants.get(interruptorId);
    const interrupted = this.currentActingCombatant;

    if (!interruptor || !interrupted) {
      ui.notifications.error(game.i18n.localize("NARUTO_RPG.Combat.InvalidInterruption"));
      return this;
    }

    if (!interruptor.canInterrupt(interrupted)) {
      ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Combat.CannotInterrupt"));
      return this;
    }

    const interruptedStatus = interrupted.getFlag(FLAG_SCOPE, COMBATANT_FLAGS.ACTION_STATUS);
    if (interruptedStatus === ACTION_STATUS.COMPLETED) {
      ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Combat.ActionAlreadyCompleted"));
      return this;
    }

    const stack = [...this.interruptionStack, interrupted.id];
    await this.setFlag(FLAG_SCOPE, COMBAT_FLAGS.INTERRUPTION_STACK, stack);

    await interrupted.setFlag(FLAG_SCOPE, COMBATANT_FLAGS.ACTION_STATUS, ACTION_STATUS.INTERRUPTED);
    await interrupted.setFlag(FLAG_SCOPE, COMBATANT_FLAGS.INTERRUPTED_BY_ID, interruptorId);

    // _setActingCombatant will handle the turn transition hooks
    await this._setActingCombatant(interruptor);

    // Dispatch Naruto RPG specific interruption hook
    Hooks.callAll(SF_HOOKS.INTERRUPTION, this, interruptor, interrupted);

    broadcastInterruption(this, interruptor, interrupted);

    return this;
  }

  /**
   * Complete the current combatant's action
   * @returns {Promise<Combat>}
   */
  async completeCurrentAction() {
    const current = this.currentActingCombatant;
    if (!current) return this;

    const currentTurn = this.turn;

    // Auto-reveal maneuver if not already revealed
    if (!current.maneuverRevealed) {
      await current.revealManeuver();
    }

    await current.setFlag(FLAG_SCOPE, COMBATANT_FLAGS.ACTION_STATUS, ACTION_STATUS.COMPLETED);

    // Dispatch end turn event for the completing combatant
    const endContext = { round: this.round, turn: currentTurn, skipped: false };
    await this._onEndTurn(current, endContext);

    // Dispatch Naruto RPG specific action completed hook
    Hooks.callAll(SF_HOOKS.ACTION_COMPLETED, this, current);

    const stack = this.interruptionStack;
    if (stack.length > 0) {
      const returnToId = stack[stack.length - 1];
      const newStack = stack.slice(0, -1);
      await this.setFlag(FLAG_SCOPE, COMBAT_FLAGS.INTERRUPTION_STACK, newStack);

      const returnTo = this.combatants.get(returnToId);
      if (returnTo) {
        await this._setActingCombatant(returnTo);
        return this;
      }
    }

    await this._advanceToNextCombatant();

    return this;
  }

  /**
   * Skip the current combatant's action
   * @returns {Promise<Combat>}
   */
  async skipCurrentAction() {
    const current = this.currentActingCombatant;
    if (!current) return this;

    const currentTurn = this.turn;

    await current.setFlag(FLAG_SCOPE, COMBATANT_FLAGS.ACTION_STATUS, ACTION_STATUS.SKIPPED);

    // Dispatch end turn event for the skipped combatant
    const endContext = { round: this.round, turn: currentTurn, skipped: true };
    await this._onEndTurn(current, endContext);

    await this._advanceToNextCombatant();

    return this;
  }

  /**
   * Advance to the next combatant in initiative order
   * @private
   */
  async _advanceToNextCombatant() {
    const ordered = this.combatantsByInitiative;
    const currentIndex = ordered.findIndex(c => c.id === this.currentActingCombatantId);

    for (let i = currentIndex + 1; i < ordered.length; i++) {
      const next = ordered[i];
      const status = next.getFlag(FLAG_SCOPE, COMBATANT_FLAGS.ACTION_STATUS);
      if (status === ACTION_STATUS.PENDING) {
        await this._setActingCombatant(next);
        return;
      }
    }

    await this.setFlag(FLAG_SCOPE, COMBAT_FLAGS.CURRENT_ACTING_ID, null);
  }

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Reset combatant flags for a new turn
   * @private
   */
  async _resetCombatantFlags() {
    for (const combatant of this.combatants) {
      await combatant.resetTurnFlags();
    }
  }

  /**
   * Reset super bars for all combatants at combat start
   * @private
   */
  async _resetSuperBars() {
    for (const combatant of this.combatants) {
      const actor = combatant.actor;
      if (actor && actor.system.resources.super) {
        await actor.update({ "system.resources.super.value": 0 });
      }
    }
  }

  /** @override */
  async nextRound() {
    return super.nextRound();
  }

  /* -------------------------------------------- */
  /*  Foundry Combat Lifecycle Hooks              */
  /*  These methods ensure compatibility with     */
  /*  standard Foundry modules                    */
  /* -------------------------------------------- */

  /**
   * A workflow that occurs at the start of each Combat Turn.
   * Called when a combatant begins their action in the execution phase.
   * @override
   * @param {Combatant} combatant - The Combatant whose turn just started
   * @param {object} context - Context data for the turn
   * @returns {Promise<void>}
   * @protected
   */
  async _onStartTurn(combatant, context) {
    // Dispatch Naruto RPG specific hook
    Hooks.callAll(SF_HOOKS.TURN_STARTED, this, combatant, context);
  }

  /**
   * A workflow that occurs at the end of each Combat Turn.
   * Called when a combatant completes their action in the execution phase.
   * @override
   * @param {Combatant} combatant - The Combatant whose turn just ended
   * @param {object} context - Context data for the turn
   * @returns {Promise<void>}
   * @protected
   */
  async _onEndTurn(combatant, context) {
    // Dispatch Naruto RPG specific hook
    Hooks.callAll(SF_HOOKS.TURN_ENDED, this, combatant, context);
  }

  /**
   * A workflow that occurs at the start of each Combat Round.
   * Called when the selection phase begins.
   * @override
   * @param {object} context - Context data for the round
   * @returns {Promise<void>}
   * @protected
   */
  async _onStartRound(context) {
    // Base Foundry implementation does nothing, but modules may hook into this
  }

  /**
   * A workflow that occurs at the end of each Combat Round.
   * Called when all combatants have completed their actions.
   * Handles Chi regeneration and other end-of-round effects.
   * @override
   * @param {object} context - Context data for the round
   * @returns {Promise<void>}
   * @protected
   */
  async _onEndRound(context) {
    // Naruto RPG specific: Chi regeneration
    for (const combatant of this.combatants) {
      const actor = combatant.actor;
      if (!actor) continue;

      if (actor.system.resources.chi) {
        const currentChi = actor.system.resources.chi.value;
        const maxChi = actor.system.resources.chi.max;
        const newChi = Math.min(maxChi, currentChi + 1);
        await actor.update({ "system.resources.chi.value": newChi });
      }
    }
  }

  /**
   * Get initiative formula for a combatant
   * @param {Combatant} combatant
   * @returns {string}
   */
  _getInitiativeFormula(combatant) {
    const actor = combatant.actor;
    if (!actor) return "1d10";

    const initiative = actor.system.combat?.initiative || 0;
    return `1d10 + ${initiative}`;
  }
}
