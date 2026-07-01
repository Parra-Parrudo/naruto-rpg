/**
 * Naruto RPG System - Effect Helpers
 * Helper functions for collecting and applying active effects
 * @author Kirlian Silvestre
 */

import {
  EFFECT_TARGET_TYPES,
  MANEUVER_STAT_TYPES,
  parseEffectKey,
  isManeuverTechniqueEffectType,
  isManeuverSpecificEffectType,
  getStatFromManeuverEffectType,
} from "../effects/effect-types.mjs";

/**
 * Collect all roll modifiers from an actor's active effects
 * @param {Actor} actor - The actor to collect modifiers from
 * @param {string|null} traitSourceId - Optional trait sourceId to filter modifiers for specific trait rolls
 * @returns {Array<{name: string, value: number, effectId: string}>}
 */
export function collectRollModifiers(actor, traitSourceId = null) {
  const modifiers = [];

  for (const effect of actor.effects) {
    if (effect.disabled) continue;

    for (const change of effect.changes) {
      const parsed = parseEffectKey(change.key);
      if (!parsed) continue;

      const value = parseInt(change.value) || 0;
      if (value === 0) continue;

      if (parsed.type === EFFECT_TARGET_TYPES.ROLL_ALL) {
        modifiers.push({
          name: effect.name,
          value: value,
          effectId: effect.id,
          isGlobal: true,
        });
      } else if (parsed.type === EFFECT_TARGET_TYPES.ROLL_TRAIT) {
        if (!traitSourceId || parsed.targetId === traitSourceId) {
          modifiers.push({
            name: effect.name,
            value: value,
            effectId: effect.id,
            traitSourceId: parsed.targetId,
            isGlobal: false,
          });
        }
      }
    }
  }

  return modifiers;
}

/**
 * Collect all trait modifiers from an actor's active effects
 * @param {Actor} actor - The actor to collect modifiers from
 * @param {string|null} traitSourceId - Optional trait sourceId to filter modifiers
 * @returns {Array<{traitSourceId: string, value: number, mode: number, effectId: string, effectName: string}>}
 */
export function collectTraitModifiers(actor, traitSourceId = null) {
  const modifiers = [];

  for (const effect of actor.effects) {
    if (effect.disabled) continue;

    for (const change of effect.changes) {
      const parsed = parseEffectKey(change.key);
      if (!parsed || parsed.type !== EFFECT_TARGET_TYPES.TRAIT) continue;

      if (traitSourceId && parsed.targetId !== traitSourceId) continue;

      const value = parseInt(change.value) || 0;
      if (value === 0) continue;

      modifiers.push({
        traitSourceId: parsed.targetId,
        value: value,
        mode: change.mode,
        effectId: effect.id,
        effectName: effect.name,
      });
    }
  }

  return modifiers;
}

/**
 * Collect all resource max modifiers from an actor's active effects
 * @param {Actor} actor - The actor to collect modifiers from
 * @param {string|null} resourceType - Optional resource type to filter modifiers
 * @returns {Array<{resourceType: string, value: number, mode: number, effectId: string, effectName: string}>}
 */
export function collectResourceMaxModifiers(actor, resourceType = null) {
  const modifiers = [];

  for (const effect of actor.effects) {
    if (effect.disabled) continue;

    for (const change of effect.changes) {
      const parsed = parseEffectKey(change.key);
      if (!parsed || parsed.type !== EFFECT_TARGET_TYPES.RESOURCE_MAX) continue;

      if (resourceType && parsed.targetId !== resourceType) continue;

      const value = parseInt(change.value) || 0;
      if (value === 0) continue;

      modifiers.push({
        resourceType: parsed.targetId,
        value: value,
        mode: change.mode,
        effectId: effect.id,
        effectName: effect.name,
      });
    }
  }

  return modifiers;
}

/**
 * Apply modifiers to a base value based on mode
 * @param {number} baseValue - The base value to modify
 * @param {Array<{value: number, mode: number}>} modifiers - Array of modifiers to apply
 * @returns {number} The modified value
 */
export function applyModifiers(baseValue, modifiers) {
  let result = baseValue;
  let additive = 0;
  let multiplicative = 1;
  let override = null;

  for (const mod of modifiers) {
    switch (mod.mode) {
      case CONST.ACTIVE_EFFECT_MODES.ADD:
        additive += mod.value;
        break;
      case CONST.ACTIVE_EFFECT_MODES.MULTIPLY:
        multiplicative *= mod.value;
        break;
      case CONST.ACTIVE_EFFECT_MODES.OVERRIDE:
        override = mod.value;
        break;
    }
  }

  if (override !== null) {
    result = override;
  } else {
    result = (result + additive) * multiplicative;
  }

  return Math.floor(result);
}

/**
 * Calculate the effective value of a trait including effect modifiers
 * @param {Actor} actor - The actor
 * @param {string} traitSourceId - The trait's sourceId
 * @param {number} baseValue - The trait's base value
 * @returns {{value: number, modifiers: Array}}
 */
export function getEffectiveTraitValue(actor, traitSourceId, baseValue) {
  const modifiers = collectTraitModifiers(actor, traitSourceId);
  const effectiveValue = applyModifiers(baseValue, modifiers);

  return {
    value: effectiveValue,
    baseValue: baseValue,
    modifiers: modifiers,
    hasModifiers: modifiers.length > 0,
  };
}

/**
 * Calculate the effective max value of a resource including effect modifiers
 * @param {Actor} actor - The actor
 * @param {string} resourceType - The resource type (health, chi, willpower)
 * @param {number} baseMax - The resource's base max value
 * @returns {{value: number, modifiers: Array}}
 */
export function getEffectiveResourceMax(actor, resourceType, baseMax) {
  const modifiers = collectResourceMaxModifiers(actor, resourceType);
  const effectiveMax = applyModifiers(baseMax, modifiers);

  return {
    value: Math.max(0, effectiveMax),
    baseValue: baseMax,
    modifiers: modifiers,
    hasModifiers: modifiers.length > 0,
  };
}

/**
 * Get roll modifiers applicable to a specific roll
 * @param {Actor} actor - The actor making the roll
 * @param {Array<string>} traitSourceIds - Array of trait sourceIds involved in the roll
 * @returns {Array<{name: string, value: number, effectId: string}>}
 */
export function getRollModifiersForTraits(actor, traitSourceIds = []) {
  const modifiers = [];
  const addedEffects = new Set();

  for (const effect of actor.effects) {
    if (effect.disabled) continue;

    for (const change of effect.changes) {
      const parsed = parseEffectKey(change.key);
      if (!parsed) continue;

      const value = parseInt(change.value) || 0;
      if (value === 0) continue;

      const modKey = `${effect.id}-${change.key}`;
      if (addedEffects.has(modKey)) continue;

      if (parsed.type === EFFECT_TARGET_TYPES.ROLL_ALL) {
        addedEffects.add(modKey);
        modifiers.push({
          name: effect.name,
          value: value,
          effectId: effect.id,
          isGlobal: true,
        });
      } else if (parsed.type === EFFECT_TARGET_TYPES.ROLL_TRAIT) {
        if (traitSourceIds.includes(parsed.targetId)) {
          addedEffects.add(modKey);
          modifiers.push({
            name: effect.name,
            value: value,
            effectId: effect.id,
            traitSourceId: parsed.targetId,
            isGlobal: false,
          });
        }
      }
    }
  }

  return modifiers;
}

/**
 * Collect maneuver modifiers by technique (category) for a specific stat
 * @param {Actor} actor - The actor to collect modifiers from
 * @param {string} techniqueId - The technique/category ID (e.g., "punch", "kick")
 * @param {string} stat - The stat to collect modifiers for (speed, damage, movement)
 * @returns {Array<{value: number, mode: number, effectId: string, effectName: string}>}
 */
export function collectManeuverTechniqueModifiers(actor, techniqueId, stat) {
  const modifiers = [];
  const normalizedTechniqueId = techniqueId.toLowerCase();

  for (const effect of actor.effects) {
    if (effect.disabled) continue;

    for (const change of effect.changes) {
      const parsed = parseEffectKey(change.key);
      if (!parsed) continue;

      if (!isManeuverTechniqueEffectType(parsed.type)) continue;

      const effectStat = getStatFromManeuverEffectType(parsed.type);
      if (effectStat !== stat) continue;

      if (parsed.targetId.toLowerCase() !== normalizedTechniqueId) continue;

      const value = parseInt(change.value) || 0;
      if (value === 0) continue;

      modifiers.push({
        value: value,
        mode: change.mode,
        effectId: effect.id,
        effectName: effect.name,
        techniqueId: parsed.targetId,
      });
    }
  }

  return modifiers;
}

/**
 * Collect maneuver modifiers for a specific maneuver item
 * @param {Actor} actor - The actor to collect modifiers from
 * @param {string} maneuverItemId - The maneuver item ID
 * @param {string} stat - The stat to collect modifiers for (speed, damage, movement)
 * @returns {Array<{value: number, mode: number, effectId: string, effectName: string}>}
 */
export function collectManeuverSpecificModifiers(actor, maneuverItemId, stat) {
  const modifiers = [];

  for (const effect of actor.effects) {
    if (effect.disabled) continue;

    for (const change of effect.changes) {
      const parsed = parseEffectKey(change.key);
      if (!parsed) continue;

      if (!isManeuverSpecificEffectType(parsed.type)) continue;

      const effectStat = getStatFromManeuverEffectType(parsed.type);
      if (effectStat !== stat) continue;

      if (parsed.targetId !== maneuverItemId) continue;

      const value = parseInt(change.value) || 0;
      if (value === 0) continue;

      modifiers.push({
        value: value,
        mode: change.mode,
        effectId: effect.id,
        effectName: effect.name,
        maneuverItemId: parsed.targetId,
      });
    }
  }

  return modifiers;
}

/**
 * Collect all maneuver modifiers for a specific maneuver and stat
 * Combines both technique-based and specific maneuver modifiers
 * @param {Actor} actor - The actor to collect modifiers from
 * @param {Item} maneuver - The maneuver item
 * @param {string} stat - The stat to collect modifiers for (speed, damage, movement)
 * @returns {Array<{value: number, mode: number, effectId: string, effectName: string, source: string}>}
 */
export function collectAllManeuverModifiers(actor, maneuver, stat) {
  const modifiers = [];

  const category = maneuver.system.category || "";
  const techniqueId = category.toLowerCase();

  if (techniqueId) {
    const techniqueModifiers = collectManeuverTechniqueModifiers(actor, techniqueId, stat);
    for (const mod of techniqueModifiers) {
      modifiers.push({
        ...mod,
        source: "technique",
      });
    }
  }

  const specificModifiers = collectManeuverSpecificModifiers(actor, maneuver.id, stat);
  for (const mod of specificModifiers) {
    modifiers.push({
      ...mod,
      source: "specific",
    });
  }

  return modifiers;
}

/**
 * Get effective maneuver stat value with all modifiers applied
 * @param {Actor} actor - The actor
 * @param {Item} maneuver - The maneuver item
 * @param {string} stat - The stat (speed, damage, movement)
 * @param {number} baseValue - The base calculated value before effect modifiers
 * @returns {{value: number, baseValue: number, modifiers: Array, hasModifiers: boolean}}
 */
export function getEffectiveManeuverStat(actor, maneuver, stat, baseValue) {
  const modifiers = collectAllManeuverModifiers(actor, maneuver, stat);
  const effectiveValue = applyModifiers(baseValue, modifiers);

  return {
    value: effectiveValue,
    baseValue: baseValue,
    modifiers: modifiers,
    hasModifiers: modifiers.length > 0,
  };
}
