/**
 * Naruto RPG Item Document
 * @author Kirlian Silvestre
 * @extends {Item}
 */

import { generateSourceId } from "../helpers/utils.mjs";

export class NarutoRpgItem extends Item {
  /** @override */
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);

    // Auto-generate sourceId if not provided
    if (!data.system?.sourceId && data.name) {
      this.updateSource({ "system.sourceId": generateSourceId(data.name) });
    }
  }

  /** @override */
  async _preUpdate(changed, options, user) {
    await super._preUpdate(changed, options, user);

    // Handle techniqueType select for technique items
    if (this.type === "technique" && changed.system?.techniqueType !== undefined) {
      const techniqueType = changed.system.techniqueType;
      changed.system.isWeaponTechnique = techniqueType === "weapon";
      changed.system.isFirearmTechnique = techniqueType === "firearm";
      delete changed.system.techniqueType;
    }
  }

  /** @override */
  prepareData() {
    super.prepareData();
  }

  /** @override */
  prepareDerivedData() {
    super.prepareDerivedData();

    const itemData = this;
    const systemData = itemData.system;

    switch (itemData.type) {
      case "maneuver":
        this._prepareManeuverData(systemData);
        break;
      case "specialMove":
        this._prepareSpecialMoveData(systemData);
        break;
      case "combo":
        this._prepareComboData(systemData);
        break;
    }
  }

  /**
   * Prepare maneuver-specific data
   * @param {object} systemData
   * @private
   */
  _prepareManeuverData(systemData) {
    systemData.totalSpeed = systemData.speed;
  }

  /**
   * Prepare special move-specific data
   * @param {object} systemData
   * @private
   */
  _prepareSpecialMoveData(systemData) {
    systemData.totalSpeed = systemData.speed;
  }

  /**
   * Prepare combo-specific data
   * @param {object} systemData
   * @private
   */
  _prepareComboData(systemData) {
    if (Array.isArray(systemData.moves)) {
      systemData.totalDamage = systemData.moves.reduce(
        (sum, move) => sum + (move.damage || 0),
        0
      );
      systemData.chiCost = systemData.moves.reduce(
        (sum, move) => sum + (move.chiCost || 0),
        0
      );
    }
  }

  /**
   * Get the actor that owns this item
   * @returns {Actor|null}
   */
  get actor() {
    return this.parent;
  }

  /**
   * Check if this item can be used
   * @returns {boolean}
   */
  canUse() {
    if (!this.actor) return false;

    if (this.type === "specialMove") {
      const chiCost = this.system.chiCost || 0;
      return this.actor.system.resources.chi.value >= chiCost;
    }

    return true;
  }

  /**
   * Use this item (roll and apply effects)
   * @returns {Promise<Roll|null>}
   */
  async use() {
    if (!this.canUse()) {
      ui.notifications.warn(
        game.i18n.localize("NARUTO_RPG.Notifications.CannotUseItem")
      );
      return null;
    }

    const actor = this.actor;
    if (!actor) return null;

    if (this.type === "specialMove" && this.system.chiCost > 0) {
      await actor.spendChi(this.system.chiCost);
    }

    return this.roll();
  }

  /**
   * Roll this item
   * @returns {Promise<Roll>}
   */
  async roll() {
    const actor = this.actor;
    const systemData = this.system;

    let formula = "1d10";
    let damage = systemData.damage || 0;

    if (actor) {
      const dex = actor.system.attributes.dexterity.value;
      formula = `${dex}d10cs>=7`;

      if (this.type === "maneuver" || this.type === "specialMove") {
        const str = actor.system.attributes.strength.value;
        damage += Math.floor(str / 2);
      }
    }

    const roll = new Roll(formula);
    await roll.evaluate();

    const content = await renderTemplate(
      "systems/naruto-rpg/templates/chat/item-card.hbs",
      {
        item: this,
        actor: actor,
        roll: roll,
        damage: damage,
      }
    );

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: actor }),
      content: content,
      roll: roll,
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
    });

    return roll;
  }
}
