/**
 * Naruto RPG System - Effect Types and Constants
 * @author Kirlian Silvestre
 */

/**
 * Effect change modes supported by the system
 * Maps to Foundry's CONST.ACTIVE_EFFECT_MODES
 */
export const EFFECT_CHANGE_MODES = {
  ADD: CONST.ACTIVE_EFFECT_MODES.ADD,
  MULTIPLY: CONST.ACTIVE_EFFECT_MODES.MULTIPLY,
  OVERRIDE: CONST.ACTIVE_EFFECT_MODES.OVERRIDE,
  CUSTOM: CONST.ACTIVE_EFFECT_MODES.CUSTOM,
};

/**
 * Effect target types - what the effect modifies
 */
export const EFFECT_TARGET_TYPES = {
  TRAIT: "trait",
  RESOURCE_MAX: "resourceMax",
  ROLL_ALL: "rollAll",
  ROLL_TRAIT: "rollTrait",
  MANEUVER_TECHNIQUE_SPEED: "maneuverTechniqueSpeed",
  MANEUVER_TECHNIQUE_DAMAGE: "maneuverTechniqueDamage",
  MANEUVER_TECHNIQUE_MOVEMENT: "maneuverTechniqueMovement",
  MANEUVER_SPECIFIC_SPEED: "maneuverSpecificSpeed",
  MANEUVER_SPECIFIC_DAMAGE: "maneuverSpecificDamage",
  MANEUVER_SPECIFIC_MOVEMENT: "maneuverSpecificMovement",
};

/**
 * Resource types that can be modified
 */
export const RESOURCE_TYPES = {
  HEALTH: "health",
  CHI: "chi",
  WILLPOWER: "willpower",
  SOAK: "soak",
};

/**
 * Trait types that can be modified
 */
export const TRAIT_TYPES = {
  ATTRIBUTE: "attribute",
  ABILITY: "ability",
  TECHNIQUE: "technique",
  BACKGROUND: "background",
};

/**
 * Maneuver stat types that can be modified by effects
 */
export const MANEUVER_STAT_TYPES = {
  SPEED: "speed",
  DAMAGE: "damage",
  MOVEMENT: "movement",
};

/**
 * Effect key prefixes for different modification types
 * Used to identify what an effect change targets
 */
export const EFFECT_KEY_PREFIXES = {
  TRAIT_MOD: "sf.trait.",
  RESOURCE_MAX: "sf.resource.max.",
  ROLL_ALL: "sf.roll.all",
  ROLL_TRAIT: "sf.roll.trait.",
  MANEUVER_TECHNIQUE_SPEED: "sf.maneuver.technique.speed.",
  MANEUVER_TECHNIQUE_DAMAGE: "sf.maneuver.technique.damage.",
  MANEUVER_TECHNIQUE_MOVEMENT: "sf.maneuver.technique.movement.",
  MANEUVER_SPECIFIC_SPEED: "sf.maneuver.specific.speed.",
  MANEUVER_SPECIFIC_DAMAGE: "sf.maneuver.specific.damage.",
  MANEUVER_SPECIFIC_MOVEMENT: "sf.maneuver.specific.movement.",
};

/**
 * Parse an effect key to determine its type and target
 * @param {string} key - The effect change key
 * @returns {object|null} Parsed key data or null if not a system key
 */
export function parseEffectKey(key) {
  if (!key || !key.startsWith("sf.")) {
    return null;
  }

  if (key.startsWith(EFFECT_KEY_PREFIXES.TRAIT_MOD)) {
    const traitSourceId = key.substring(EFFECT_KEY_PREFIXES.TRAIT_MOD.length);
    return {
      type: EFFECT_TARGET_TYPES.TRAIT,
      targetId: traitSourceId,
    };
  }

  if (key.startsWith(EFFECT_KEY_PREFIXES.RESOURCE_MAX)) {
    const resourceType = key.substring(EFFECT_KEY_PREFIXES.RESOURCE_MAX.length);
    return {
      type: EFFECT_TARGET_TYPES.RESOURCE_MAX,
      targetId: resourceType,
    };
  }

  if (key === EFFECT_KEY_PREFIXES.ROLL_ALL) {
    return {
      type: EFFECT_TARGET_TYPES.ROLL_ALL,
      targetId: null,
    };
  }

  if (key.startsWith(EFFECT_KEY_PREFIXES.ROLL_TRAIT)) {
    const traitSourceId = key.substring(EFFECT_KEY_PREFIXES.ROLL_TRAIT.length);
    return {
      type: EFFECT_TARGET_TYPES.ROLL_TRAIT,
      targetId: traitSourceId,
    };
  }

  if (key.startsWith(EFFECT_KEY_PREFIXES.MANEUVER_TECHNIQUE_SPEED)) {
    const techniqueId = key.substring(EFFECT_KEY_PREFIXES.MANEUVER_TECHNIQUE_SPEED.length);
    return {
      type: EFFECT_TARGET_TYPES.MANEUVER_TECHNIQUE_SPEED,
      targetId: techniqueId,
      stat: MANEUVER_STAT_TYPES.SPEED,
    };
  }

  if (key.startsWith(EFFECT_KEY_PREFIXES.MANEUVER_TECHNIQUE_DAMAGE)) {
    const techniqueId = key.substring(EFFECT_KEY_PREFIXES.MANEUVER_TECHNIQUE_DAMAGE.length);
    return {
      type: EFFECT_TARGET_TYPES.MANEUVER_TECHNIQUE_DAMAGE,
      targetId: techniqueId,
      stat: MANEUVER_STAT_TYPES.DAMAGE,
    };
  }

  if (key.startsWith(EFFECT_KEY_PREFIXES.MANEUVER_TECHNIQUE_MOVEMENT)) {
    const techniqueId = key.substring(EFFECT_KEY_PREFIXES.MANEUVER_TECHNIQUE_MOVEMENT.length);
    return {
      type: EFFECT_TARGET_TYPES.MANEUVER_TECHNIQUE_MOVEMENT,
      targetId: techniqueId,
      stat: MANEUVER_STAT_TYPES.MOVEMENT,
    };
  }

  if (key.startsWith(EFFECT_KEY_PREFIXES.MANEUVER_SPECIFIC_SPEED)) {
    const maneuverItemId = key.substring(EFFECT_KEY_PREFIXES.MANEUVER_SPECIFIC_SPEED.length);
    return {
      type: EFFECT_TARGET_TYPES.MANEUVER_SPECIFIC_SPEED,
      targetId: maneuverItemId,
      stat: MANEUVER_STAT_TYPES.SPEED,
    };
  }

  if (key.startsWith(EFFECT_KEY_PREFIXES.MANEUVER_SPECIFIC_DAMAGE)) {
    const maneuverItemId = key.substring(EFFECT_KEY_PREFIXES.MANEUVER_SPECIFIC_DAMAGE.length);
    return {
      type: EFFECT_TARGET_TYPES.MANEUVER_SPECIFIC_DAMAGE,
      targetId: maneuverItemId,
      stat: MANEUVER_STAT_TYPES.DAMAGE,
    };
  }

  if (key.startsWith(EFFECT_KEY_PREFIXES.MANEUVER_SPECIFIC_MOVEMENT)) {
    const maneuverItemId = key.substring(EFFECT_KEY_PREFIXES.MANEUVER_SPECIFIC_MOVEMENT.length);
    return {
      type: EFFECT_TARGET_TYPES.MANEUVER_SPECIFIC_MOVEMENT,
      targetId: maneuverItemId,
      stat: MANEUVER_STAT_TYPES.MOVEMENT,
    };
  }

  return null;
}

/**
 * Build an effect key from type and target
 * @param {string} type - Effect target type from EFFECT_TARGET_TYPES
 * @param {string} targetId - Target identifier (sourceId for traits, resource type for resources)
 * @returns {string} The effect key
 */
export function buildEffectKey(type, targetId = null) {
  switch (type) {
    case EFFECT_TARGET_TYPES.TRAIT:
      return `${EFFECT_KEY_PREFIXES.TRAIT_MOD}${targetId}`;
    case EFFECT_TARGET_TYPES.RESOURCE_MAX:
      return `${EFFECT_KEY_PREFIXES.RESOURCE_MAX}${targetId}`;
    case EFFECT_TARGET_TYPES.ROLL_ALL:
      return EFFECT_KEY_PREFIXES.ROLL_ALL;
    case EFFECT_TARGET_TYPES.ROLL_TRAIT:
      return `${EFFECT_KEY_PREFIXES.ROLL_TRAIT}${targetId}`;
    case EFFECT_TARGET_TYPES.MANEUVER_TECHNIQUE_SPEED:
      return `${EFFECT_KEY_PREFIXES.MANEUVER_TECHNIQUE_SPEED}${targetId}`;
    case EFFECT_TARGET_TYPES.MANEUVER_TECHNIQUE_DAMAGE:
      return `${EFFECT_KEY_PREFIXES.MANEUVER_TECHNIQUE_DAMAGE}${targetId}`;
    case EFFECT_TARGET_TYPES.MANEUVER_TECHNIQUE_MOVEMENT:
      return `${EFFECT_KEY_PREFIXES.MANEUVER_TECHNIQUE_MOVEMENT}${targetId}`;
    case EFFECT_TARGET_TYPES.MANEUVER_SPECIFIC_SPEED:
      return `${EFFECT_KEY_PREFIXES.MANEUVER_SPECIFIC_SPEED}${targetId}`;
    case EFFECT_TARGET_TYPES.MANEUVER_SPECIFIC_DAMAGE:
      return `${EFFECT_KEY_PREFIXES.MANEUVER_SPECIFIC_DAMAGE}${targetId}`;
    case EFFECT_TARGET_TYPES.MANEUVER_SPECIFIC_MOVEMENT:
      return `${EFFECT_KEY_PREFIXES.MANEUVER_SPECIFIC_MOVEMENT}${targetId}`;
    default:
      return "";
  }
}

/**
 * Get localization key for effect target type
 * @param {string} type - Effect target type
 * @returns {string} Localization key
 */
export function getEffectTargetTypeLabel(type) {
  const labels = {
    [EFFECT_TARGET_TYPES.TRAIT]: "NARUTO_RPG.ActiveEffects.TargetTypes.trait",
    [EFFECT_TARGET_TYPES.RESOURCE_MAX]: "NARUTO_RPG.ActiveEffects.TargetTypes.resourceMax",
    [EFFECT_TARGET_TYPES.ROLL_ALL]: "NARUTO_RPG.ActiveEffects.TargetTypes.rollAll",
    [EFFECT_TARGET_TYPES.ROLL_TRAIT]: "NARUTO_RPG.ActiveEffects.TargetTypes.rollTrait",
    [EFFECT_TARGET_TYPES.MANEUVER_TECHNIQUE_SPEED]: "NARUTO_RPG.ActiveEffects.TargetTypes.maneuverTechniqueSpeed",
    [EFFECT_TARGET_TYPES.MANEUVER_TECHNIQUE_DAMAGE]: "NARUTO_RPG.ActiveEffects.TargetTypes.maneuverTechniqueDamage",
    [EFFECT_TARGET_TYPES.MANEUVER_TECHNIQUE_MOVEMENT]: "NARUTO_RPG.ActiveEffects.TargetTypes.maneuverTechniqueMovement",
    [EFFECT_TARGET_TYPES.MANEUVER_SPECIFIC_SPEED]: "NARUTO_RPG.ActiveEffects.TargetTypes.maneuverSpecificSpeed",
    [EFFECT_TARGET_TYPES.MANEUVER_SPECIFIC_DAMAGE]: "NARUTO_RPG.ActiveEffects.TargetTypes.maneuverSpecificDamage",
    [EFFECT_TARGET_TYPES.MANEUVER_SPECIFIC_MOVEMENT]: "NARUTO_RPG.ActiveEffects.TargetTypes.maneuverSpecificMovement",
  };
  return labels[type] || "";
}

/**
 * Get localization key for resource type
 * @param {string} resourceType - Resource type
 * @returns {string} Localization key
 */
export function getResourceTypeLabel(resourceType) {
  const labels = {
    [RESOURCE_TYPES.HEALTH]: "NARUTO_RPG.Resources.health",
    [RESOURCE_TYPES.CHI]: "NARUTO_RPG.Resources.chi",
    [RESOURCE_TYPES.WILLPOWER]: "NARUTO_RPG.Resources.willpower",
    [RESOURCE_TYPES.SOAK]: "NARUTO_RPG.Combat.soak",
  };
  return labels[resourceType] || "";
}

/**
 * Get localization key for maneuver stat type
 * @param {string} statType - Maneuver stat type
 * @returns {string} Localization key
 */
export function getManeuverStatTypeLabel(statType) {
  const labels = {
    [MANEUVER_STAT_TYPES.SPEED]: "NARUTO_RPG.ActiveEffects.ManeuverStats.speed",
    [MANEUVER_STAT_TYPES.DAMAGE]: "NARUTO_RPG.ActiveEffects.ManeuverStats.damage",
    [MANEUVER_STAT_TYPES.MOVEMENT]: "NARUTO_RPG.ActiveEffects.ManeuverStats.movement",
  };
  return labels[statType] || "";
}

/**
 * Check if an effect target type is a maneuver modifier
 * @param {string} type - Effect target type
 * @returns {boolean}
 */
export function isManeuverEffectType(type) {
  return [
    EFFECT_TARGET_TYPES.MANEUVER_TECHNIQUE_SPEED,
    EFFECT_TARGET_TYPES.MANEUVER_TECHNIQUE_DAMAGE,
    EFFECT_TARGET_TYPES.MANEUVER_TECHNIQUE_MOVEMENT,
    EFFECT_TARGET_TYPES.MANEUVER_SPECIFIC_SPEED,
    EFFECT_TARGET_TYPES.MANEUVER_SPECIFIC_DAMAGE,
    EFFECT_TARGET_TYPES.MANEUVER_SPECIFIC_MOVEMENT,
  ].includes(type);
}

/**
 * Check if an effect target type targets a technique (category)
 * @param {string} type - Effect target type
 * @returns {boolean}
 */
export function isManeuverTechniqueEffectType(type) {
  return [
    EFFECT_TARGET_TYPES.MANEUVER_TECHNIQUE_SPEED,
    EFFECT_TARGET_TYPES.MANEUVER_TECHNIQUE_DAMAGE,
    EFFECT_TARGET_TYPES.MANEUVER_TECHNIQUE_MOVEMENT,
  ].includes(type);
}

/**
 * Check if an effect target type targets a specific maneuver
 * @param {string} type - Effect target type
 * @returns {boolean}
 */
export function isManeuverSpecificEffectType(type) {
  return [
    EFFECT_TARGET_TYPES.MANEUVER_SPECIFIC_SPEED,
    EFFECT_TARGET_TYPES.MANEUVER_SPECIFIC_DAMAGE,
    EFFECT_TARGET_TYPES.MANEUVER_SPECIFIC_MOVEMENT,
  ].includes(type);
}

/**
 * Get the stat type from a maneuver effect target type
 * @param {string} type - Effect target type
 * @returns {string|null} The stat type or null
 */
export function getStatFromManeuverEffectType(type) {
  const statMap = {
    [EFFECT_TARGET_TYPES.MANEUVER_TECHNIQUE_SPEED]: MANEUVER_STAT_TYPES.SPEED,
    [EFFECT_TARGET_TYPES.MANEUVER_TECHNIQUE_DAMAGE]: MANEUVER_STAT_TYPES.DAMAGE,
    [EFFECT_TARGET_TYPES.MANEUVER_TECHNIQUE_MOVEMENT]: MANEUVER_STAT_TYPES.MOVEMENT,
    [EFFECT_TARGET_TYPES.MANEUVER_SPECIFIC_SPEED]: MANEUVER_STAT_TYPES.SPEED,
    [EFFECT_TARGET_TYPES.MANEUVER_SPECIFIC_DAMAGE]: MANEUVER_STAT_TYPES.DAMAGE,
    [EFFECT_TARGET_TYPES.MANEUVER_SPECIFIC_MOVEMENT]: MANEUVER_STAT_TYPES.MOVEMENT,
  };
  return statMap[type] || null;
}
