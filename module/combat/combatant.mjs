/**
 * Naruto RPG Combatant Document
 * Manages individual combatant state in the two-phase combat system
 * @author Kirlian Silvestre
 * @extends {Combatant}
 */

import {
  SELECTION_STATUS,
  ACTION_STATUS,
  FLAG_SCOPE,
  COMBATANT_FLAGS,
  SF_HOOKS,
  getDefaultCombatantFlags,
  createSelectedManeuver,
  canInterrupt
} from "./combat-phases.mjs";

export class NarutoRpgCombatant extends Combatant {

  /* -------------------------------------------- */
  /*  Accessors                                   */
  /* -------------------------------------------- */

  /**
   * Get the selected maneuver data
   * @returns {object|null}
   */
  get selectedManeuver() {
    return this.getFlag(FLAG_SCOPE, COMBATANT_FLAGS.SELECTED_MANEUVER) ?? null;
  }

  /**
   * Get the selected maneuver's speed value (integer for display)
   * @returns {number|null}
   */
  get selectedManeuverSpeed() {
    return this.selectedManeuver?.speed ?? null;
  }

  /**
   * Get the selected maneuver's speed tiebreaker value (composite for ordering)
   * @returns {number|null}
   */
  get selectedManeuverSpeedTiebreaker() {
    return this.selectedManeuver?.speedTiebreaker ?? this.selectedManeuver?.speed ?? null;
  }

  /**
   * Get the selection status
   * @returns {string}
   */
  get selectionStatus() {
    return this.getFlag(FLAG_SCOPE, COMBATANT_FLAGS.SELECTION_STATUS) ?? SELECTION_STATUS.PENDING;
  }

  /**
   * Get the action status
   * @returns {string}
   */
  get actionStatus() {
    return this.getFlag(FLAG_SCOPE, COMBATANT_FLAGS.ACTION_STATUS) ?? ACTION_STATUS.PENDING;
  }

  /**
   * Check if the maneuver has been revealed
   * @returns {boolean}
   */
  get maneuverRevealed() {
    return this.getFlag(FLAG_SCOPE, COMBATANT_FLAGS.MANEUVER_REVEALED) ?? false;
  }

  /**
   * Get the ID of the combatant who interrupted this one
   * @returns {string|null}
   */
  get interruptedById() {
    return this.getFlag(FLAG_SCOPE, COMBATANT_FLAGS.INTERRUPTED_BY_ID) ?? null;
  }

  /**
   * Check if this combatant has completed their selection
   * @returns {boolean}
   */
  get hasSelectedManeuver() {
    return this.selectionStatus === SELECTION_STATUS.READY && this.selectedManeuver !== null;
  }

  /**
   * Check if this combatant is currently acting
   * @returns {boolean}
   */
  get isActing() {
    return this.actionStatus === ACTION_STATUS.ACTING || this.actionStatus === ACTION_STATUS.REVEALED;
  }

  /**
   * Check if this combatant can still be interrupted
   * @returns {boolean}
   */
  get canBeInterrupted() {
    const status = this.actionStatus;
    return status === ACTION_STATUS.ACTING || status === ACTION_STATUS.REVEALED;
  }

  /**
   * Check if this combatant is defeated
   * @returns {boolean}
   */
  get isDefeated() {
    const actor = this.actor;
    if (!actor) return false;

    const health = actor.system.resources?.health;
    if (!health) return false;

    return health.value <= 0;
  }

  /* -------------------------------------------- */
  /*  Lifecycle Methods                           */
  /* -------------------------------------------- */

  /** @override */
  prepareBaseData() {
    super.prepareBaseData();
  }

  /* -------------------------------------------- */
  /*  Flag Management                             */
  /* -------------------------------------------- */

  /**
   * Initialize flags for a new combatant
   * @returns {Promise<Combatant>}
   */
  async initializeFlags() {
    const flags = getDefaultCombatantFlags();
    await this.update({ [`flags.${FLAG_SCOPE}`]: flags });
    return this;
  }

  /**
   * Reset flags for a new turn
   * @returns {Promise<Combatant>}
   */
  async resetTurnFlags() {
    await this.setFlag(FLAG_SCOPE, COMBATANT_FLAGS.SELECTED_MANEUVER, null);
    await this.setFlag(FLAG_SCOPE, COMBATANT_FLAGS.SELECTION_STATUS, SELECTION_STATUS.PENDING);
    await this.setFlag(FLAG_SCOPE, COMBATANT_FLAGS.ACTION_STATUS, ACTION_STATUS.PENDING);
    await this.setFlag(FLAG_SCOPE, COMBATANT_FLAGS.MANEUVER_REVEALED, false);
    await this.setFlag(FLAG_SCOPE, COMBATANT_FLAGS.INTERRUPTED_BY_ID, null);
    return this;
  }

  /* -------------------------------------------- */
  /*  Maneuver Selection                          */
  /* -------------------------------------------- */

  /**
   * Set the selected maneuver for this combatant
   * @param {object} maneuverData - The maneuver data
   * @param {string} maneuverData.itemId - The maneuver item ID
   * @param {string} maneuverData.name - The maneuver name
   * @param {number} maneuverData.speed - Calculated speed value
   * @param {number} maneuverData.damage - Calculated damage value
   * @param {number} maneuverData.movement - Calculated movement value
   * @param {string} maneuverData.category - Maneuver category
   * @returns {Promise<Combatant>}
   */
  async selectManeuver(maneuverData) {
    const selectedManeuver = createSelectedManeuver(maneuverData);

    await this.setFlag(FLAG_SCOPE, COMBATANT_FLAGS.SELECTED_MANEUVER, selectedManeuver);
    await this.setFlag(FLAG_SCOPE, COMBATANT_FLAGS.SELECTION_STATUS, SELECTION_STATUS.READY);

    // Dispatch Naruto RPG specific maneuver selected hook
    Hooks.callAll(SF_HOOKS.MANEUVER_SELECTED, this.parent, this, selectedManeuver);

    return this;
  }

  /**
   * Clear the selected maneuver
   * @returns {Promise<Combatant>}
   */
  async clearManeuverSelection() {
    await this.setFlag(FLAG_SCOPE, COMBATANT_FLAGS.SELECTED_MANEUVER, null);
    await this.setFlag(FLAG_SCOPE, COMBATANT_FLAGS.SELECTION_STATUS, SELECTION_STATUS.PENDING);
    return this;
  }

  /* -------------------------------------------- */
  /*  Action Management                           */
  /* -------------------------------------------- */

  /**
   * Reveal the selected maneuver to all players
   * @returns {Promise<Combatant>}
   */
  async revealManeuver() {
    if (!this.selectedManeuver) {
      ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Combat.NoManeuverSelected"));
      return this;
    }

    await this.setFlag(FLAG_SCOPE, COMBATANT_FLAGS.MANEUVER_REVEALED, true);
    await this.setFlag(FLAG_SCOPE, COMBATANT_FLAGS.ACTION_STATUS, ACTION_STATUS.REVEALED);

    // Dispatch Naruto RPG specific maneuver revealed hook
    Hooks.callAll(SF_HOOKS.MANEUVER_REVEALED, this.parent, this, this.selectedManeuver);

    await this._postManeuverToChat();

    return this;
  }

  /**
   * Post the revealed maneuver to chat
   * @private
   */
  async _postManeuverToChat() {
    const maneuver = this.selectedManeuver;
    if (!maneuver) return;

    const messageData = {
      speaker: ChatMessage.getSpeaker({ actor: this.actor, token: this.token }),
      content: await foundry.applications.handlebars.renderTemplate(
        "systems/naruto-rpg/templates/chat/maneuver-reveal-card.hbs",
        {
          combatantName: this.name,
          maneuver: maneuver,
          actorId: this.actor?.id,
          tokenId: this.token?.id
        }
      ),
      type: CONST.CHAT_MESSAGE_STYLES.OTHER
    };

    await ChatMessage.create(messageData);
  }

  /* -------------------------------------------- */
  /*  Interruption                                */
  /* -------------------------------------------- */

  /**
   * Check if this combatant can interrupt another combatant
   * @param {Combatant} target - The target combatant to potentially interrupt
   * @returns {boolean}
   */
  canInterrupt(target) {
    if (!target || target.id === this.id) return false;

    if (this.isDefeated) return false;

    const myStatus = this.actionStatus;
    if (myStatus === ACTION_STATUS.COMPLETED || myStatus === ACTION_STATUS.SKIPPED) {
      return false;
    }

    if (!target.canBeInterrupted) return false;

    const mySpeedTiebreaker = this.selectedManeuverSpeedTiebreaker;
    const targetSpeedTiebreaker = target.selectedManeuverSpeedTiebreaker;

    if (mySpeedTiebreaker === null || targetSpeedTiebreaker === null) return false;

    return canInterrupt(mySpeedTiebreaker, targetSpeedTiebreaker);
  }

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Get the initiative value for this combatant
   * @returns {number}
   */
  getInitiativeValue() {
    const actor = this.actor;
    if (!actor) return 0;

    return actor.system.combat?.initiative || 0;
  }

  /**
   * Get all available maneuvers for this combatant's actor
   * @returns {Item[]}
   */
  getAvailableManeuvers() {
    const actor = this.actor;
    if (!actor) return [];

    return actor.items.filter(item => item.type === "specialManeuver");
  }
}
