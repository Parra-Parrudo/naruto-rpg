/**
 * Naruto RPG Combat Tracker
 * Custom combat tracker UI with two-phase combat system support
 * @author Kirlian Silvestre
 */

import { returnCombatCards } from "../helpers/combat-cards.mjs";
import {
  COMBAT_PHASE,
  SELECTION_STATUS,
  ACTION_STATUS,
  FLAG_SCOPE,
  COMBAT_FLAGS,
  COMBATANT_FLAGS
} from "./combat-phases.mjs";

import { ManeuverSelectionDialog } from "./maneuver-selection-dialog.mjs";
import { ActionTurnDialog } from "./action-turn-dialog.mjs";
import { requestInterruption, requestCompleteAction } from "./combat-socket.mjs";

/**
 * Naruto RPG Combat Tracker Application
 * Replaces the default Foundry combat tracker with Naruto RPG specific functionality
 */
export class NarutoRpgCombatTracker extends foundry.applications.sidebar.tabs.CombatTracker {

  /** @override */
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    id: "combat",
    actions: {
      startTurn: NarutoRpgCombatTracker._onStartTurn,
      returnCards: NarutoRpgCombatTracker._onReturnCards,
      startExecution: NarutoRpgCombatTracker._onStartExecution,
      nextTurn: NarutoRpgCombatTracker._onNextTurn,
      openManeuverSelection: NarutoRpgCombatTracker._onOpenManeuverSelection,
      openTurnDialog: NarutoRpgCombatTracker._onOpenTurnDialog,
      interrupt: NarutoRpgCombatTracker._onInterrupt,
      completeAction: NarutoRpgCombatTracker._onCompleteAction,
      revealManeuver: NarutoRpgCombatTracker._onRevealManeuver,
      createCombat: NarutoRpgCombatTracker._onCreateCombat,
      endCombat: NarutoRpgCombatTracker._onEndCombat,
      rollAll: NarutoRpgCombatTracker._onRollAll,
      rollNPC: NarutoRpgCombatTracker._onRollNPC,
      resetAll: NarutoRpgCombatTracker._onResetAll,
      previousCombat: NarutoRpgCombatTracker._onPreviousCombat,
      nextCombat: NarutoRpgCombatTracker._onNextCombat,
      toggleHidden: NarutoRpgCombatTracker._onToggleHidden,
      toggleDefeatedStatus: NarutoRpgCombatTracker._onToggleDefeated,
      configure: NarutoRpgCombatTracker._onConfigure
    }
  }, { inplace: false });

  /** @override */
  static PARTS = {
    tracker: {
      template: "systems/naruto-rpg/templates/combat/combat-tracker.hbs"
    }
  };

  /* -------------------------------------------- */
  /*  Context Preparation                         */
  /* -------------------------------------------- */

  /** @override */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);

    const isGM = game.user.isGM;
    const combats = this.combats;
    const combat = this.viewed;

    // Ensure combats context is available
    context.combats = combats;
    context.combatCount = combats.length;
    context.combatIndex = combat ? combats.findIndex(c => c.id === combat.id) + 1 : 0;
    context.viewed = combat;

    // Always provide sfCombat context for template
    if (!combat) {
      context.sfCombat = {
        phase: COMBAT_PHASE.SETUP,
        phaseLabel: this._getPhaseLabel(COMBAT_PHASE.SETUP),
        isSetup: true,
        isSelection: false,
        isExecution: false,
        turnStarted: false,
        allSelectionsComplete: false,
        allActionsComplete: false,
        currentActingId: null,
        isGM: isGM
      };
      return context;
    }

    const phase = combat.phase;

    context.sfCombat = {
      phase: phase,
      phaseLabel: this._getPhaseLabel(phase),
      isSetup: phase === COMBAT_PHASE.SETUP,
      isSelection: phase === COMBAT_PHASE.SELECTION,
      isExecution: phase === COMBAT_PHASE.EXECUTION,
      turnStarted: combat.turnStarted,
      allSelectionsComplete: combat.allSelectionsComplete,
      allActionsComplete: combat.allActionsComplete,
      currentActingId: combat.currentActingCombatantId,
      isGM: isGM
    };

    if (context.turns && Array.isArray(context.turns)) {
      context.turns = await this._prepareCombatantContexts(combat, context.turns);
    } else if (combat.combatants?.size) {
      context.turns = await this._buildTurnsFromCombatants(combat);
    }

    // Note: Turn ordering is now handled by NarutoRpgCombat._sortCombatants
    // which sorts by speed during execution phase. No need to re-sort here.

    return context;
  }

  /**
   * Build turns array from combatants when parent doesn't provide it
   * @param {Combat} combat
   * @returns {Promise<object[]>}
   * @private
   */
  async _buildTurnsFromCombatants(combat) {
    const turns = [];
    for (const combatant of combat.combatants) {
      const turn = await this._prepareTurnContext(combat, combatant, turns.length);
      turns.push(turn);
    }
    return this._prepareCombatantContexts(combat, turns);
  }

  /**
   * Prepare context for a single turn/combatant
   * @param {Combat} combat
   * @param {Combatant} combatant
   * @param {number} index
   * @returns {Promise<object>}
   * @private
   */
  async _prepareTurnContext(combat, combatant, index) {
    const token = combatant.token;
    const actor = combatant.actor;

    return {
      id: combatant.id,
      name: combatant.name,
      img: await this._getCombatantThumbnail(combatant),
      initiative: combatant.initiative,
      hidden: combatant.hidden,
      defeated: combatant.isDefeated,
      owner: combatant.isOwner,
      tokenId: token?.id ?? null,
      actorId: actor?.id ?? null,
      canPing: combatant.isOwner && canvas.ready,
      css: combatant.isDefeated ? "defeated" : ""
    };
  }

  /**
   * Get localized phase label
   * @param {string} phase
   * @returns {string}
   * @private
   */
  _getPhaseLabel(phase) {
    const labels = {
      [COMBAT_PHASE.SETUP]: "NARUTO_RPG.Combat.Phase.Setup",
      [COMBAT_PHASE.SELECTION]: "NARUTO_RPG.Combat.Phase.Selection",
      [COMBAT_PHASE.EXECUTION]: "NARUTO_RPG.Combat.Phase.Execution"
    };
    return game.i18n.localize(labels[phase] || labels[COMBAT_PHASE.SETUP]);
  }

  /**
   * Prepare additional context for each combatant
   * @param {Combat} combat
   * @param {object[]} turns
   * @returns {Promise<object[]>}
   * @private
   */
  async _prepareCombatantContexts(combat, turns) {
    const phase = combat.phase;
    const currentActingId = combat.currentActingCombatantId;
    const currentActing = combat.currentActingCombatant;
    const hidePlayerManeuversFromGM = game.settings.get("naruto-rpg", "hidePlayerManeuversFromGM");

    return turns.map(turn => {
      const combatant = combat.combatants.get(turn.id);
      if (!combatant) return turn;

      const selectionStatus = combatant.selectionStatus;
      const actionStatus = combatant.actionStatus;
      const selectedManeuver = combatant.selectedManeuver;
      const isOwner = combatant.isOwner;
      const isNPC = combatant.isNPC;
      const isGM = game.user.isGM;

      // Check if this combatant belongs to an online player (not NPC, owned by a non-GM player)
      const isOnlinePlayerCombatant = !isNPC && this._isOwnedByOnlinePlayer(combatant);

      // Should hide maneuver from GM for online player combatants?
      const shouldHideFromGM = isGM && hidePlayerManeuversFromGM && isOnlinePlayerCombatant && !combatant.maneuverRevealed;

      const isDefeated = combatant.isDefeated;

      const canOpenManeuverDialog = phase === COMBAT_PHASE.SELECTION &&
        selectionStatus !== SELECTION_STATUS.READY &&
        !isDefeated &&
        (isOwner || (isGM && isNPC));

      const canInterrupt = phase === COMBAT_PHASE.EXECUTION &&
        currentActing &&
        combatant.id !== currentActingId &&
        !isDefeated &&
        combatant.canInterrupt(currentActing) &&
        (isOwner || isGM);

      const showManeuverButton = phase === COMBAT_PHASE.SELECTION &&
        !isDefeated &&
        (isOwner || (isGM && isNPC));

      return {
        ...turn,
        sf: {
          selectionStatus,
          actionStatus,
          selectedManeuver: shouldHideFromGM ? null : selectedManeuver,
          isReady: selectionStatus === SELECTION_STATUS.READY,
          isActing: combatant.id === currentActingId,
          isCompleted: actionStatus === ACTION_STATUS.COMPLETED,
          isSkipped: actionStatus === ACTION_STATUS.SKIPPED,
          isInterrupted: actionStatus === ACTION_STATUS.INTERRUPTED,
          maneuverRevealed: combatant.maneuverRevealed,
          // Speed is always visible during execution phase, hidden only during selection for GM
          speed: (phase === COMBAT_PHASE.EXECUTION || !shouldHideFromGM) ? (selectedManeuver?.speed ?? null) : null,
          canOpenManeuverDialog,
          canInterrupt,
          showManeuverButton,
          isOwner,
          isNPC,
          shouldHideFromGM,
          statusIcon: this._getStatusIcon(phase, selectionStatus, actionStatus, combatant.id === currentActingId),
          statusLabel: this._getStatusLabel(phase, selectionStatus, actionStatus)
        }
      };
    });
  }

  /**
   * Check if a combatant is owned by an online player
   * @param {Combatant} combatant
   * @returns {boolean}
   * @private
   */
  _isOwnedByOnlinePlayer(combatant) {
    const actor = combatant.actor;
    if (!actor) return false;

    // Check if any non-GM user has ownership (regardless of online status)
    // This ensures the setting works even when testing alone
    const players = game.users.filter(u => !u.isGM);
    return players.some(user => actor.testUserPermission(user, "OWNER"));
  }

  /**
   * Get status icon class for a combatant
   * @param {string} phase
   * @param {string} selectionStatus
   * @param {string} actionStatus
   * @param {boolean} isActing
   * @returns {string}
   * @private
   */
  _getStatusIcon(phase, selectionStatus, actionStatus, isActing) {
    if (phase === COMBAT_PHASE.SELECTION) {
      return selectionStatus === SELECTION_STATUS.READY
        ? "fas fa-check-circle nrpg-status-ready"
        : "fas fa-hourglass-half nrpg-status-pending";
    }

    if (phase === COMBAT_PHASE.EXECUTION) {
      if (isActing) return "fas fa-bolt nrpg-status-acting";
      if (actionStatus === ACTION_STATUS.COMPLETED) return "fas fa-check-circle nrpg-status-completed";
      if (actionStatus === ACTION_STATUS.SKIPPED) return "fas fa-forward nrpg-status-skipped";
      if (actionStatus === ACTION_STATUS.INTERRUPTED) return "fas fa-pause-circle nrpg-status-interrupted";
      return "fas fa-clock nrpg-status-pending";
    }

    return "fas fa-circle nrpg-status-setup";
  }

  /**
   * Get status label for a combatant
   * @param {string} phase
   * @param {string} selectionStatus
   * @param {string} actionStatus
   * @returns {string}
   * @private
   */
  _getStatusLabel(phase, selectionStatus, actionStatus) {
    if (phase === COMBAT_PHASE.SELECTION) {
      return selectionStatus === SELECTION_STATUS.READY
        ? game.i18n.localize("NARUTO_RPG.Combat.Status.Ready")
        : game.i18n.localize("NARUTO_RPG.Combat.Status.Selecting");
    }

    if (phase === COMBAT_PHASE.EXECUTION) {
      const labels = {
        [ACTION_STATUS.PENDING]: "NARUTO_RPG.Combat.Status.Waiting",
        [ACTION_STATUS.ACTING]: "NARUTO_RPG.Combat.Status.Acting",
        [ACTION_STATUS.REVEALED]: "NARUTO_RPG.Combat.Status.Revealed",
        [ACTION_STATUS.INTERRUPTED]: "NARUTO_RPG.Combat.Status.Interrupted",
        [ACTION_STATUS.COMPLETED]: "NARUTO_RPG.Combat.Status.Completed",
        [ACTION_STATUS.SKIPPED]: "NARUTO_RPG.Combat.Status.Skipped"
      };
      return game.i18n.localize(labels[actionStatus] || labels[ACTION_STATUS.PENDING]);
    }

    return "";
  }

  /* -------------------------------------------- */
  /*  Action Handlers                             */
  /* -------------------------------------------- */

  /**
   * Handle starting a new turn (selection phase)
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @this {NarutoRpgCombatTracker}
   */
  static async _onReturnCards(event, target) {
    event.preventDefault();
    await returnCombatCards();
  }

  static async _onStartTurn(event, target) {
    event.preventDefault();
    const combat = this.viewed;
    if (!combat || !game.user.isGM) return;

    await combat.startSelectionPhase();
  }

  /**
   * Handle starting the execution phase
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @this {NarutoRpgCombatTracker}
   */
  static async _onStartExecution(event, target) {
    event.preventDefault();
    const combat = this.viewed;
    if (!combat || !game.user.isGM) return;

    await combat.startExecutionPhase();
  }

  /**
   * Handle advancing to the next turn
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @this {NarutoRpgCombatTracker}
   */
  static async _onNextTurn(event, target) {
    event.preventDefault();
    const combat = this.viewed;
    if (!combat || !game.user.isGM) return;

    await combat.advanceToNextTurn();
  }

  /**
   * Handle opening the maneuver selection dialog
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @this {NarutoRpgCombatTracker}
   */
  static async _onOpenManeuverSelection(event, target) {
    event.preventDefault();
    const combat = this.viewed;
    if (!combat) return;

    const combatantId = target.closest("[data-combatant-id]")?.dataset.combatantId;
    if (!combatantId) return;

    const combatant = combat.combatants.get(combatantId);
    if (!combatant) return;

    if (!combatant.isOwner && !game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Combat.NotYourCombatant"));
      return;
    }

    await ManeuverSelectionDialog.show(combat, combatant);
  }

  /**
   * Handle opening the turn dialog
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @this {NarutoRpgCombatTracker}
   */
  static async _onOpenTurnDialog(event, target) {
    event.preventDefault();
    const combat = this.viewed;
    if (!combat) return;

    const combatantId = target.closest("[data-combatant-id]")?.dataset.combatantId;
    if (!combatantId) return;

    const combatant = combat.combatants.get(combatantId);
    if (!combatant) return;

    if (!combatant.isOwner && !game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Combat.NotYourCombatant"));
      return;
    }

    await ActionTurnDialog.show(combat, combatant);
  }

  /**
   * Handle interruption
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @this {NarutoRpgCombatTracker}
   */
  static async _onInterrupt(event, target) {
    event.preventDefault();
    const combat = this.viewed;
    if (!combat) return;

    const combatantId = target.closest("[data-combatant-id]")?.dataset.combatantId;
    if (!combatantId) return;

    const combatant = combat.combatants.get(combatantId);
    if (!combatant) return;

    if (!combatant.isOwner && !game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Combat.NotYourCombatant"));
      return;
    }

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("NARUTO_RPG.Combat.InterruptTitle") },
      content: game.i18n.format("NARUTO_RPG.Combat.InterruptConfirm", {
        name: combatant.name,
        target: combat.currentActingCombatant?.name || ""
      })
    });

    if (confirmed) {
      requestInterruption(combat, combatantId);
    }
  }

  /**
   * Handle completing the current action
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @this {NarutoRpgCombatTracker}
   */
  static async _onCompleteAction(event, target) {
    event.preventDefault();
    const combat = this.viewed;
    if (!combat) return;

    const currentActing = combat.currentActingCombatant;
    if (!currentActing) return;

    if (!currentActing.isOwner && !game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Combat.NotYourCombatant"));
      return;
    }

    requestCompleteAction(combat);
  }

  /**
   * Handle revealing the current combatant's maneuver
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @this {NarutoRpgCombatTracker}
   */
  static async _onRevealManeuver(event, target) {
    event.preventDefault();
    const combat = this.viewed;
    if (!combat) return;

    const combatantId = target.closest("[data-combatant-id]")?.dataset.combatantId;
    if (!combatantId) return;

    const combatant = combat.combatants.get(combatantId);
    if (!combatant) return;

    if (!combatant.isOwner && !game.user.isGM) {
      ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Combat.NotYourCombatant"));
      return;
    }

    await combatant.revealManeuver();
    ui.combat?.render();
  }

  /* -------------------------------------------- */
  /*  Standard Combat Tracker Actions             */
  /* -------------------------------------------- */

  /**
   * Handle creating a new combat encounter
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @this {NarutoRpgCombatTracker}
   */
  static async _onCreateCombat(event, target) {
    event.preventDefault();
    await Combat.create({ scene: canvas.scene?.id, active: true });
  }

  /**
   * Handle ending the current combat
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @this {NarutoRpgCombatTracker}
   */
  static async _onEndCombat(event, target) {
    event.preventDefault();
    const combat = this.viewed;
    if (!combat || !game.user.isGM) return;
    await combat.endCombat();
  }

  /**
   * Handle rolling initiative for all combatants
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @this {NarutoRpgCombatTracker}
   */
  static async _onRollAll(event, target) {
    event.preventDefault();
    const combat = this.viewed;
    if (!combat || !game.user.isGM) return;
    await combat.rollAll();
  }

  /**
   * Handle rolling initiative for NPC combatants
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @this {NarutoRpgCombatTracker}
   */
  static async _onRollNPC(event, target) {
    event.preventDefault();
    const combat = this.viewed;
    if (!combat || !game.user.isGM) return;
    await combat.rollNPC();
  }

  /**
   * Handle resetting all initiative
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @this {NarutoRpgCombatTracker}
   */
  static async _onResetAll(event, target) {
    event.preventDefault();
    const combat = this.viewed;
    if (!combat || !game.user.isGM) return;
    await combat.resetAll();
  }

  /**
   * Handle cycling to the previous combat
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @this {NarutoRpgCombatTracker}
   */
  static async _onPreviousCombat(event, target) {
    event.preventDefault();
    const combats = this.combats;
    const current = this.viewed;
    if (!combats.length || !current) return;
    const index = combats.findIndex(c => c.id === current.id);
    const prev = combats[(index - 1 + combats.length) % combats.length];
    await prev.activate();
  }

  /**
   * Handle cycling to the next combat
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @this {NarutoRpgCombatTracker}
   */
  static async _onNextCombat(event, target) {
    event.preventDefault();
    const combats = this.combats;
    const current = this.viewed;
    if (!combats.length || !current) return;
    const index = combats.findIndex(c => c.id === current.id);
    const next = combats[(index + 1) % combats.length];
    await next.activate();
  }

  /**
   * Handle toggling combatant hidden status
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @this {NarutoRpgCombatTracker}
   */
  static async _onToggleHidden(event, target) {
    event.preventDefault();
    const combat = this.viewed;
    if (!combat || !game.user.isGM) return;

    const combatantId = target.closest("[data-combatant-id]")?.dataset.combatantId;
    if (!combatantId) return;

    const combatant = combat.combatants.get(combatantId);
    if (!combatant) return;

    await combatant.update({ hidden: !combatant.hidden });
  }

  /**
   * Handle toggling combatant defeated status
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @this {NarutoRpgCombatTracker}
   */
  static async _onToggleDefeated(event, target) {
    event.preventDefault();
    const combat = this.viewed;
    if (!combat || !game.user.isGM) return;

    const combatantId = target.closest("[data-combatant-id]")?.dataset.combatantId;
    if (!combatantId) return;

    const combatant = combat.combatants.get(combatantId);
    if (!combatant) return;

    await combatant.update({ defeated: !combatant.defeated });
  }

  /**
   * Handle opening combat configuration
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @this {NarutoRpgCombatTracker}
   */
  static async _onConfigure(event, target) {
    event.preventDefault();
    new foundry.applications.apps.CombatTrackerConfig().render(true);
  }
}
