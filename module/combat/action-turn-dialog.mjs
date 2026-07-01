/**
 * Naruto RPG Action Turn Dialog
 * Displays the current combatant's turn panel with reveal/skip options
 * @author Kirlian Silvestre
 */

import {
  COMBAT_PHASE,
  ACTION_STATUS,
  FLAG_SCOPE,
  COMBATANT_FLAGS
} from "./combat-phases.mjs";

import { broadcastManeuverRevealed } from "./combat-socket.mjs";
import { NarutoRpgRollDialog, executeRoll } from "../dice/roll-dialog.mjs";
import { prepareManeuverRollData } from "../helpers/maneuver-calculator.mjs";

/**
 * Dialog shown to a player when it's their combatant's turn
 * @extends {foundry.applications.api.ApplicationV2}
 */
export class ActionTurnDialog extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  /**
   * @param {Combat} combat - The combat document
   * @param {Combatant} combatant - The combatant whose turn it is
   * @param {object} options - Application options
   */
  constructor(combat, combatant, options = {}) {
    super(options);
    this.combat = combat;
    this.combatant = combatant;

    this._onCombatUpdate = this._onCombatUpdate.bind(this);
    Hooks.on("updateCombat", this._onCombatUpdate);
    Hooks.on("updateCombatant", this._onCombatUpdate);
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "action-turn-dialog-{id}",
    classes: ["naruto-rpg", "action-turn-dialog"],
    window: {
      frame: true,
      positioned: true,
      title: "NARUTO_RPG.Combat.YourTurn",
      icon: "fas fa-bolt",
      minimizable: false,
      resizable: false
    },
    position: {
      width: 400,
      height: "auto"
    },
    actions: {
      revealManeuver: ActionTurnDialog._onRevealManeuver,
      skipTurn: ActionTurnDialog._onSkipTurn,
      toggleNotes: ActionTurnDialog._onToggleNotes,
      rollManeuver: ActionTurnDialog._onRollManeuver
    }
  };

  /** @override */
  static PARTS = {
    content: {
      template: "systems/naruto-rpg/templates/combat/action-turn-dialog.hbs"
    }
  };

  /** @override */
  get title() {
    return game.i18n.format("NARUTO_RPG.Combat.YourTurnTitle", {
      name: this.combatant.name
    });
  }

  /** @override */
  async _prepareContext(options) {
    const maneuver = this.combatant.selectedManeuver;
    const actionStatus = this.combatant.actionStatus;
    const isRevealed = this.combatant.maneuverRevealed;

    return {
      combatant: this.combatant,
      maneuver: maneuver,
      hasManeuver: !!maneuver,
      isRevealed: isRevealed,
      actionStatus: actionStatus,
      canReveal: actionStatus === ACTION_STATUS.ACTING && !isRevealed,
      canSkip: actionStatus === ACTION_STATUS.ACTING || actionStatus === ACTION_STATUS.REVEALED,
      statusLabel: this._getStatusLabel(actionStatus)
    };
  }

  /**
   * Get a localized label for the action status
   * @param {string} status
   * @returns {string}
   * @private
   */
  _getStatusLabel(status) {
    const labels = {
      [ACTION_STATUS.PENDING]: "NARUTO_RPG.Combat.Status.Pending",
      [ACTION_STATUS.ACTING]: "NARUTO_RPG.Combat.Status.Acting",
      [ACTION_STATUS.REVEALED]: "NARUTO_RPG.Combat.Status.Revealed",
      [ACTION_STATUS.INTERRUPTED]: "NARUTO_RPG.Combat.Status.Interrupted",
      [ACTION_STATUS.COMPLETED]: "NARUTO_RPG.Combat.Status.Completed",
      [ACTION_STATUS.SKIPPED]: "NARUTO_RPG.Combat.Status.Skipped"
    };

    return game.i18n.localize(labels[status] || labels[ACTION_STATUS.PENDING]);
  }

  /**
   * Handle combat updates to close dialog if no longer acting
   * @param {Combat} combat
   * @param {object} change
   * @param {object} options
   * @param {string} userId
   * @private
   */
  _onCombatUpdate(combat, change, options, userId) {
    if (combat.id !== this.combat.id) return;

    const currentActingId = this.combat.currentActingCombatantId;
    const myStatus = this.combatant.actionStatus;

    if (currentActingId !== this.combatant.id ||
        myStatus === ACTION_STATUS.COMPLETED ||
        myStatus === ACTION_STATUS.SKIPPED ||
        myStatus === ACTION_STATUS.INTERRUPTED) {
      this.close();
      return;
    }

    this.render();
  }

  /** @override */
  async close(options = {}) {
    Hooks.off("updateCombat", this._onCombatUpdate);
    Hooks.off("updateCombatant", this._onCombatUpdate);
    return super.close(options);
  }

  /**
   * Handle revealing the maneuver
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @this {ActionTurnDialog}
   */
  static async _onRevealManeuver(event, target) {
    event.preventDefault();

    const maneuver = this.combatant.selectedManeuver;
    if (!maneuver) {
      ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Combat.NoManeuverSelected"));
      return;
    }

    await this.combatant.revealManeuver();

    broadcastManeuverRevealed(this.combat, this.combatant, maneuver.name);

    this.render();
  }

  /**
   * Handle skipping the turn
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @this {ActionTurnDialog}
   */
  static async _onSkipTurn(event, target) {
    event.preventDefault();

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("NARUTO_RPG.Combat.SkipTurnTitle") },
      content: game.i18n.localize("NARUTO_RPG.Combat.SkipTurnConfirm")
    });

    if (confirmed) {
      await this.combat.skipCurrentAction();
      await this.close();
    }
  }

  /**
   * Handle rolling the maneuver damage
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @this {ActionTurnDialog}
   */
  static async _onRollManeuver(event, target) {
    event.preventDefault();

    const selectedManeuver = this.combatant.selectedManeuver;
    if (!selectedManeuver) {
      ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Combat.NoManeuverSelected"));
      return;
    }

    const actor = this.combatant.actor;
    if (!actor) return;

    const maneuver = actor.items.get(selectedManeuver.itemId);
    if (!maneuver) {
      ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Combat.ManeuverNotFound"));
      return;
    }

    const rollOptions = prepareManeuverRollData(actor, maneuver);
    const rollData = await NarutoRpgRollDialog.create(actor, rollOptions);

    if (rollData) {
      await executeRoll(rollData);
    }
  }

  /**
   * Handle toggling the notes accordion
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @this {ActionTurnDialog}
   */
  static _onToggleNotes(event, target) {
    event.preventDefault();
    event.stopPropagation();

    const card = target.closest(".nrpg-maneuver-card");
    if (!card) return;

    const notesSection = card.querySelector(".nrpg-maneuver-notes");
    if (!notesSection) return;

    const isCollapsed = notesSection.classList.contains("collapsed");
    notesSection.classList.toggle("collapsed", !isCollapsed);
    notesSection.classList.toggle("expanded", isCollapsed);

    const icon = target.querySelector("i");
    if (icon) {
      icon.classList.toggle("fa-chevron-down", !isCollapsed);
      icon.classList.toggle("fa-chevron-up", isCollapsed);
    }
  }

  /**
   * Show the action turn dialog for a combatant
   * @param {Combat} combat - The combat document
   * @param {Combatant} combatant - The combatant whose turn it is
   * @returns {Promise<ActionTurnDialog>}
   */
  static async show(combat, combatant) {
    if (combat.phase !== COMBAT_PHASE.EXECUTION) {
      return null;
    }

    if (combat.currentActingCombatantId !== combatant.id) {
      return null;
    }

    const existingDialog = Object.values(ui.windows).find(
      w => w instanceof ActionTurnDialog && w.combatant?.id === combatant.id
    );

    if (existingDialog) {
      existingDialog.bringToFront();
      return existingDialog;
    }

    const dialog = new ActionTurnDialog(combat, combatant, {
      id: `action-turn-dialog-${combatant.id}`
    });

    await dialog.render(true);
    return dialog;
  }

  /**
   * Close all action turn dialogs
   */
  static closeAll() {
    const dialogs = Object.values(ui.windows).filter(w => w instanceof ActionTurnDialog);
    for (const dialog of dialogs) {
      dialog.close();
    }
  }
}
