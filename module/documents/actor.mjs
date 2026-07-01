/**
 * Naruto RPG Actor Document
 * @author Kirlian Silvestre
 * @extends {Actor}
 */

import {
  collectTraitModifiers,
  collectResourceMaxModifiers,
  applyModifiers,
  getRollModifiersForTraits,
} from "../helpers/effect-helpers.mjs";
import { addNonOptionalTraitsToActor } from "../helpers/utils.mjs";

export class NarutoRpgActor extends Actor {
  /** @override */
  prepareData() {
    super.prepareData();
  }

  /** @override */
  prepareBaseData() {
    super.prepareBaseData();
  }

  /** @override */
  async _onCreate(data, options, userId) {
    await super._onCreate(data, options, userId);

    if (game.user.id !== userId) return;
    if (this.type !== "fighter") return;

    const isImported = this.system.importData?.isImported === true;
    if (isImported) return;

    if (game.settings.get("naruto-rpg", "autoAddTraitsOnManualCreate")) {
      await addNonOptionalTraitsToActor(this);
    }
  }

  /** @override */
  _onCreateDescendantDocuments(parent, collection, documents, data, options, userId) {
    super._onCreateDescendantDocuments(parent, collection, documents, data, options, userId);

    if (game.user.id !== userId) return;
    if (collection !== "items") return;

    // Check if a fighting style was added
    const addedStyle = documents.find(doc => doc.type === "fightingStyle");
    if (addedStyle) {
      this._applyFightingStyleResources(addedStyle);
    }
  }

  /** @override */
  _onDeleteDescendantDocuments(parent, collection, documents, ids, options, userId) {
    super._onDeleteDescendantDocuments(parent, collection, documents, ids, options, userId);

    if (game.user.id !== userId) return;
    if (collection !== "items") return;

    // Check if a fighting style was removed
    const removedStyle = documents.find(doc => doc.type === "fightingStyle");
    if (removedStyle) {
      this._removeFightingStyleResources(removedStyle);
    }
  }

  /**
   * Apply fighting style resource bonuses to the actor
   * @param {Item} style - The fighting style item
   * @private
   */
  async _applyFightingStyleResources(style) {
    const initialChi = style.system.initialChi ?? 0;
    const initialWillpower = style.system.initialWillpower ?? 0;

    const currentChiMax = this.system.resources?.chi?.max ?? 0;
    const currentWillpowerMax = this.system.resources?.willpower?.max ?? 0;

    const newChiMax = currentChiMax + initialChi;
    const newWillpowerMax = currentWillpowerMax + initialWillpower;

    await this.update({
      "system.resources.chi.max": newChiMax,
      "system.resources.chi.value": newChiMax,
      "system.resources.willpower.max": newWillpowerMax,
      "system.resources.willpower.value": newWillpowerMax,
    });
  }

  /**
   * Remove fighting style resource bonuses from the actor
   * @param {Item} style - The fighting style item being removed
   * @private
   */
  async _removeFightingStyleResources(style) {
    const initialChi = style.system.initialChi ?? 0;
    const initialWillpower = style.system.initialWillpower ?? 0;

    const currentChiMax = this.system.resources?.chi?.max ?? 0;
    const currentWillpowerMax = this.system.resources?.willpower?.max ?? 0;

    const newChiMax = Math.max(0, currentChiMax - initialChi);
    const newWillpowerMax = Math.max(0, currentWillpowerMax - initialWillpower);

    await this.update({
      "system.resources.chi.max": newChiMax,
      "system.resources.chi.value": newChiMax,
      "system.resources.willpower.max": newWillpowerMax,
      "system.resources.willpower.value": newWillpowerMax,
    });
  }

  /** @override */
  prepareDerivedData() {
    super.prepareDerivedData();

    const actorData = this;
    const systemData = actorData.system;

    this._prepareCommonData(systemData);

    if (actorData.type === "fighter") {
      this._prepareFighterData(systemData);
    }
  }

  /**
   * Get trait value from embedded items by sourceId (base value without effects)
   * @param {string} sourceId - The sourceId of the trait
   * @returns {number} The trait value or 0 if not found
   * @private
   */
  _getTraitValue(sourceId) {
    const item = this.items.find(i => i.system.sourceId === sourceId);
    return item?.system.value ?? 0;
  }

  /**
   * Get effective trait value including active effect modifiers
   * @param {string} sourceId - The sourceId of the trait
   * @returns {number} The effective trait value
   */
  getEffectiveTraitValue(sourceId) {
    const baseValue = this._getTraitValue(sourceId);
    const modifiers = collectTraitModifiers(this, sourceId);
    return applyModifiers(baseValue, modifiers);
  }

  /**
   * Get effective resource max value including active effect modifiers
   * @param {string} resourceType - The resource type (health, chi, willpower)
   * @returns {number} The effective max value
   */
  getEffectiveResourceMax(resourceType) {
    const baseMax = this.system.resources?.[resourceType]?.max ?? 0;
    const modifiers = collectResourceMaxModifiers(this, resourceType);
    return Math.max(0, applyModifiers(baseMax, modifiers));
  }

  /**
   * Get roll modifiers from active effects for a specific roll
   * @param {Array<string>} traitSourceIds - Array of trait sourceIds involved in the roll
   * @returns {Array<{name: string, value: number, effectId: string}>}
   */
  getRollModifiers(traitSourceIds = []) {
    return getRollModifiersForTraits(this, traitSourceIds);
  }

  /**
   * Get effective soak value including active effect modifiers
   * Soak = Stamina + effects targeting soak
   * @returns {number} The effective soak value
   */
  getEffectiveSoak() {
    const baseSoak = this.system.combat?.soak ?? 0;
    const modifiers = collectResourceMaxModifiers(this, "soak");
    return Math.max(0, applyModifiers(baseSoak, modifiers));
  }

  /**
   * Prepare common data for all actor types
   * @param {object} systemData
   * @private
   */
  _prepareCommonData(systemData) {
    // Initialize combat object if it doesn't exist
    if (!systemData.combat) {
      systemData.combat = {};
    }

    // Get attribute values from embedded items
    const wits = this._getTraitValue("wits");
    const dexterity = this._getTraitValue("dexterity");
    const stamina = this._getTraitValue("stamina");

    // Initiative = Wits + Dexterity
    systemData.combat.initiative = wits + dexterity;
    // Soak = Stamina (not half)
    systemData.combat.soak = stamina;
  }

  /**
   * Prepare fighter-specific data
   * Note: health.max, chi.max, willpower.max come from character data (imported or manual)
   * They are NOT calculated from attributes
   * @param {object} systemData
   * @private
   */
  _prepareFighterData(systemData) {
    // Resource max values come from the character data, not calculated
    // For imported characters: values come from the import
    // For manual characters: values are set directly by the user
  }

  /**
   * Roll an attribute check
   * @param {string} attributeKey - The sourceId of the attribute to roll
   * @returns {Promise<Roll>}
   */
  async rollAttribute(attributeKey) {
    const value = this._getTraitValue(attributeKey);
    if (value === 0) return null;

    // Find the item to get its name
    const item = this.items.find(i => i.system.sourceId === attributeKey);
    const label = item?.name || attributeKey;

    const roll = new Roll(`${value}d10cs>=7`);
    await roll.evaluate();

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: label,
    });

    return roll;
  }

  /**
   * Apply damage to the actor
   * @param {number} amount - Amount of damage to apply
   * @returns {Promise<Actor>}
   */
  async applyDamage(amount) {
    const currentHealth = this.system.resources.health.value;
    const newHealth = Math.max(0, currentHealth - amount);

    return this.update({ "system.resources.health.value": newHealth });
  }

  /**
   * Restore health to the actor
   * @param {number} amount - Amount of health to restore
   * @returns {Promise<Actor>}
   */
  async restoreHealth(amount) {
    const currentHealth = this.system.resources.health.value;
    const maxHealth = this.system.resources.health.max;
    const newHealth = Math.min(maxHealth, currentHealth + amount);

    return this.update({ "system.resources.health.value": newHealth });
  }

  /**
   * Spend chi
   * @param {number} amount - Amount of chi to spend
   * @returns {Promise<Actor|null>}
   */
  async spendChi(amount) {
    const currentChi = this.system.resources.chi.value;
    if (currentChi < amount) {
      ui.notifications.warn(
        game.i18n.localize("NARUTO_RPG.Notifications.NotEnoughChi")
      );
      return null;
    }

    return this.update({ "system.resources.chi.value": currentChi - amount });
  }
}
