/**
 * Naruto RPG Active Effect Document
 * @author Kirlian Silvestre
 * @extends {ActiveEffect}
 */

import { parseEffectKey, EFFECT_TARGET_TYPES } from "./effect-types.mjs";

export class NarutoRpgEffect extends ActiveEffect {
  /**
   * Whether this effect is suppressed (inactive)
   * Maps disabled to suppressed for consistency with Genesys terminology
   * @type {boolean}
   */
  get isSuppressed() {
    return this.disabled;
  }

  /**
   * Get the item that originated this effect (if any)
   * @type {Item|undefined}
   */
  get originItem() {
    if (!this.origin || !this.parent || !(this.parent instanceof Actor)) {
      return undefined;
    }

    if (!this.origin.includes(".Item.")) {
      return undefined;
    }

    const itemId = this.origin.split(".Item.")[1];
    return this.parent.items.get(itemId);
  }

  /**
   * Collect all roll modifiers from this effect
   * @returns {Array<{name: string, value: number, traitSourceId: string|null}>}
   */
  getRollModifiers() {
    if (this.disabled) return [];

    const modifiers = [];

    for (const change of this.changes) {
      const parsed = parseEffectKey(change.key);
      if (!parsed) continue;

      const value = parseInt(change.value) || 0;
      if (value === 0) continue;

      if (parsed.type === EFFECT_TARGET_TYPES.ROLL_ALL) {
        modifiers.push({
          name: this.name,
          value: value,
          traitSourceId: null,
          isGlobal: true,
        });
      } else if (parsed.type === EFFECT_TARGET_TYPES.ROLL_TRAIT) {
        modifiers.push({
          name: this.name,
          value: value,
          traitSourceId: parsed.targetId,
          isGlobal: false,
        });
      }
    }

    return modifiers;
  }

  /**
   * Collect all trait modifiers from this effect
   * @returns {Array<{traitSourceId: string, value: number, mode: number}>}
   */
  getTraitModifiers() {
    if (this.disabled) return [];

    const modifiers = [];

    for (const change of this.changes) {
      const parsed = parseEffectKey(change.key);
      if (!parsed || parsed.type !== EFFECT_TARGET_TYPES.TRAIT) continue;

      const value = parseInt(change.value) || 0;
      if (value === 0) continue;

      modifiers.push({
        traitSourceId: parsed.targetId,
        value: value,
        mode: change.mode,
      });
    }

    return modifiers;
  }

  /**
   * Collect all resource max modifiers from this effect
   * @returns {Array<{resourceType: string, value: number, mode: number}>}
   */
  getResourceMaxModifiers() {
    if (this.disabled) return [];

    const modifiers = [];

    for (const change of this.changes) {
      const parsed = parseEffectKey(change.key);
      if (!parsed || parsed.type !== EFFECT_TARGET_TYPES.RESOURCE_MAX) continue;

      const value = parseInt(change.value) || 0;
      if (value === 0) continue;

      modifiers.push({
        resourceType: parsed.targetId,
        value: value,
        mode: change.mode,
      });
    }

    return modifiers;
  }
}
