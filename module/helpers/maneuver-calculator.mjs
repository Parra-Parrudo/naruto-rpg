/**
 * Naruto RPG System - Maneuver Calculator
 * Centralized service for calculating maneuver statistics (SSOT)
 * @author Kirlian Silvestre
 */

import { MANEUVER_STAT_TYPES } from "../effects/effect-types.mjs";
import { getEffectiveTraitValue, getEffectiveManeuverStat } from "./effect-helpers.mjs";

/**
 * Get character stats needed for maneuver calculations
 * @param {Actor} actor - The actor
 * @returns {object} Character stats object
 */
export function getCharacterStatsForManeuver(actor) {
  const findTraitValue = (sourceId) => {
    if (!sourceId) return 0;
    const item = actor.items.find(i => i.system.sourceId === sourceId);
    if (!item) return 0;
    const baseValue = item.system.value || 0;
    const effective = getEffectiveTraitValue(actor, sourceId, baseValue);
    return effective.value;
  };

  const techniques = actor.items.filter(i => i.type === "technique");
  const techniquesMap = {};
  for (const t of techniques) {
    const key = t.system.sourceId || t.name.toLowerCase();
    const baseValue = t.system.value || 0;
    const effective = getEffectiveTraitValue(actor, key, baseValue);
    techniquesMap[key] = {
      value: effective.value,
      isWeaponTechnique: t.system.isWeaponTechnique || false,
      isFirearmTechnique: t.system.isFirearmTechnique || false,
    };
  }

  return {
    findTraitValue,
    dexterity: findTraitValue("dexterity"),
    strength: findTraitValue("strength"),
    wits: findTraitValue("wits"),
    athletics: findTraitValue("athletics"),
    techniques: techniquesMap,
  };
}

/**
 * Calculate a modifier value from maneuver modifier string
 * @param {string} modifier - The modifier string (e.g., "+2", "-1", "x2")
 * @param {number} base - The base value
 * @returns {number}
 */
export function calculateModifierValue(modifier, base) {
  if (!modifier) return base;

  const modStr = String(modifier).trim();

  if (modStr.startsWith("x") || modStr.startsWith("*")) {
    const multiplier = parseFloat(modStr.slice(1)) || 1;
    return Math.floor(base * multiplier);
  }

  const modValue = parseInt(modStr.replace(/^\+/, "")) || 0;
  return base + modValue;
}

/**
 * Format original modifier for display
 * @param {string} modifierStr - The original modifier string
 * @returns {string} Formatted string for display
 */
export function formatOriginalModifier(modifierStr) {
  if (!modifierStr || modifierStr === "") return "—";

  if (modifierStr.startsWith("+") || modifierStr.startsWith("-")) {
    return modifierStr;
  }

  const lowerMod = modifierStr.toLowerCase().trim();
  if (lowerMod === "nenhum" || lowerMod === "none") return "—";
  if (lowerMod === "um" || lowerMod === "one") return "1";
  if (lowerMod === "dois" || lowerMod === "two") return "2";

  const value = parseInt(modifierStr);
  if (!isNaN(value)) return modifierStr;

  return "*";
}

/**
 * Calculate maneuver statistics with all modifiers applied
 * This is the SSOT for maneuver stat calculations
 * @param {Actor} actor - The actor
 * @param {Item} maneuver - The maneuver item
 * @param {object} [options] - Optional parameters
 * @param {object} [options.characterStats] - Pre-calculated character stats (for performance)
 * @returns {ManeuverStats}
 */
export function calculateManeuverStats(actor, maneuver, options = {}) {
  const characterStats = options.characterStats || getCharacterStatsForManeuver(actor);
  const { findTraitValue } = characterStats;

  const category = maneuver.system.category || "";
  const categoryKey = category.toLowerCase();

  const effectiveTechniqueKey = maneuver.system.damageTraitOverride || categoryKey;
  const techniqueData = characterStats.techniques[effectiveTechniqueKey] || {
    value: 0,
    isWeaponTechnique: false,
    isFirearmTechnique: false,
  };
  const techniqueValue = techniqueData.value;
  const isWeaponTechnique = techniqueData.isWeaponTechnique || techniqueData.isFirearmTechnique;
  const isFirearmTechnique = techniqueData.isFirearmTechnique;

  const weapons = actor.items.filter(i => i.type === "weapon");
  const equippedWeapons = isWeaponTechnique
    ? weapons.filter(w => w.system.isEquipped && (w.system.techniqueId || "").toLowerCase() === effectiveTechniqueKey)
    : [];

  const singleEquippedWeapon = equippedWeapons.length === 1 ? equippedWeapons[0] : null;
  const parseWeaponMod = (val) => parseInt(String(val || "0").replace(/^\+/, "")) || 0;
  const weaponSpeedMod = singleEquippedWeapon ? parseWeaponMod(singleEquippedWeapon.system.speed) : 0;
  const weaponDamageMod = singleEquippedWeapon ? parseWeaponMod(singleEquippedWeapon.system.damage) : 0;
  const weaponMovementMod = singleEquippedWeapon ? parseWeaponMod(singleEquippedWeapon.system.movement) : 0;

  let speedBase;
  if (maneuver.system.speedTraitOverride) {
    speedBase = findTraitValue(maneuver.system.speedTraitOverride);
  } else if (isFirearmTechnique) {
    speedBase = characterStats.wits;
  } else {
    speedBase = characterStats.dexterity;
  }
  const baseSpeed = calculateModifierValue(maneuver.system.speedModifier, speedBase + weaponSpeedMod);

  let damageAttribute;
  if (maneuver.system.damageAttributeOverride) {
    damageAttribute = findTraitValue(maneuver.system.damageAttributeOverride);
  } else if (isFirearmTechnique) {
    damageAttribute = 0;
  } else {
    damageAttribute = characterStats.strength;
  }
  const damageBase = damageAttribute + techniqueValue;
  const baseDamage = calculateModifierValue(maneuver.system.damageModifier, damageBase + weaponDamageMod);

  let movementBase;
  if (maneuver.system.movementTraitOverride) {
    movementBase = findTraitValue(maneuver.system.movementTraitOverride);
  } else if (isFirearmTechnique) {
    movementBase = 0;
  } else {
    movementBase = characterStats.athletics;
  }
  const baseMovement = calculateModifierValue(maneuver.system.movementModifier, movementBase + weaponMovementMod);

  const speedEffective = getEffectiveManeuverStat(actor, maneuver, MANEUVER_STAT_TYPES.SPEED, baseSpeed);
  const damageEffective = getEffectiveManeuverStat(actor, maneuver, MANEUVER_STAT_TYPES.DAMAGE, baseDamage);
  const movementEffective = getEffectiveManeuverStat(actor, maneuver, MANEUVER_STAT_TYPES.MOVEMENT, baseMovement);

  return {
    id: maneuver.id,
    name: maneuver.name,
    img: maneuver.img,
    category: category,
    system: maneuver.system,

    calculatedSpeed: speedEffective.value,
    calculatedDamage: damageEffective.value,
    calculatedMovement: movementEffective.value,

    baseSpeed: baseSpeed,
    baseDamage: baseDamage,
    baseMovement: baseMovement,

    originalSpeedModifier: maneuver.system.speedModifier,
    originalDamageModifier: maneuver.system.damageModifier,
    originalMovementModifier: maneuver.system.movementModifier,

    originalSpeed: formatOriginalModifier(maneuver.system.speedModifier),
    originalDamage: formatOriginalModifier(maneuver.system.damageModifier),
    originalMovement: formatOriginalModifier(maneuver.system.movementModifier),

    speedModifiers: speedEffective.modifiers,
    damageModifiers: damageEffective.modifiers,
    movementModifiers: movementEffective.modifiers,

    hasSpeedModifiers: speedEffective.hasModifiers,
    hasDamageModifiers: damageEffective.hasModifiers,
    hasMovementModifiers: movementEffective.hasModifiers,
    hasAnyModifiers: speedEffective.hasModifiers || damageEffective.hasModifiers || movementEffective.hasModifiers,

    chiCost: maneuver.system.chiCost || 0,
    willpowerCost: maneuver.system.willpowerCost || 0,
    notes: maneuver.system.notes || "",
    ruleSummary: maneuver.system.ruleSummary || "",

    isWeaponTechnique,
    isFirearmTechnique,

    equippedWeapons: equippedWeapons.map(w => ({
      id: w.id,
      name: w.name,
      damageMod: parseWeaponMod(w.system.damage),
      speedMod: parseWeaponMod(w.system.speed),
      movementMod: parseWeaponMod(w.system.movement),
    })),
  };
}

/**
 * Prepare all maneuvers for an actor with calculated stats
 * @param {Actor} actor - The actor
 * @param {object} [options] - Optional parameters
 * @param {boolean} [options.sortBySpeed] - Sort by calculated speed (default: true)
 * @returns {Array<ManeuverStats>}
 */
export function prepareActorManeuvers(actor, options = {}) {
  const { sortBySpeed = true } = options;

  const maneuvers = actor.items.filter(item => item.type === "specialManeuver");
  const characterStats = getCharacterStatsForManeuver(actor);

  const prepared = maneuvers.map(maneuver =>
    calculateManeuverStats(actor, maneuver, { characterStats })
  );

  if (sortBySpeed) {
    prepared.sort((a, b) => a.calculatedSpeed - b.calculatedSpeed);
  }

  return prepared;
}

/**
 * Group maneuvers by category/technique
 * @param {Array<ManeuverStats>} maneuvers - Array of prepared maneuvers
 * @returns {object} Object with category keys and maneuver arrays
 */
export function groupManeuversByCategory(maneuvers) {
  const grouped = {};

  for (const maneuver of maneuvers) {
    const category = maneuver.category || "other";
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(maneuver);
  }

  return grouped;
}

/**
 * Prepare roll data for a maneuver
 * This is the SSOT for preparing maneuver roll dialog data
 * @param {Actor} actor - The actor performing the maneuver
 * @param {Item} maneuver - The maneuver item
 * @returns {object} Roll dialog options
 */
export function prepareManeuverRollData(actor, maneuver) {
  const category = maneuver.system.category || "";
  const categoryKey = category.toLowerCase();

  let strengthItem = null;
  let techniqueItem = null;

  for (const item of actor.items) {
    if (item.type === "attribute") {
      const sourceId = item.system.sourceId || "";
      if (sourceId === "strength") {
        strengthItem = item;
      }
    }
    if (item.type === "technique") {
      const sourceId = item.system.sourceId || "";
      if (sourceId === categoryKey) {
        techniqueItem = item;
      }
    }
  }

  const isWeaponTechnique = techniqueItem?.system.isWeaponTechnique || techniqueItem?.system.isFirearmTechnique || false;
  const attributeItem = isWeaponTechnique ? null : strengthItem;

  let damageModValue = null;
  const damageModStr = maneuver.system.damageModifier || "";
  if (damageModStr.startsWith("+") || damageModStr.startsWith("-")) {
    damageModValue = parseInt(damageModStr);
  }

  const equippedWeapons = [];
  if (isWeaponTechnique) {
    for (const item of actor.items) {
      const weaponTechniqueId = (item.system.techniqueId || "").toLowerCase();
      if (item.type === "weapon" && item.system.isEquipped && weaponTechniqueId === categoryKey) {
        const damageStr = String(item.system.damage || "0");
        const damageMod = parseInt(damageStr.replace(/^\+/, "")) || 0;
        equippedWeapons.push({
          id: item.id,
          name: item.name,
          damageMod,
          selected: false,
        });
      }
    }
    if (equippedWeapons.length === 1) {
      equippedWeapons[0].selected = true;
    }
  }

  let targetSoak = null;
  let targetName = null;
  const firstTarget = game.user.targets.first();
  if (firstTarget?.actor) {
    const targetActor = firstTarget.actor;
    targetSoak = targetActor.getEffectiveSoak?.() ?? targetActor.system.combat?.soak ?? 0;
    targetName = targetActor.name;
  }

  return {
    selectedTraitId: attributeItem?.id,
    selectedTraitType: "attribute",
    preSelectedSecondTrait: techniqueItem?.id,
    maneuverName: maneuver.name,
    maneuverDamageModifier: damageModValue,
    equippedWeapons,
    targetSoak,
    targetName,
    rollTitle: maneuver.name,
    isDamageRoll: true,
  };
}

/**
 * Check if actor can afford a maneuver's costs
 * @param {Actor} actor - The actor
 * @param {Item|ManeuverStats} maneuver - The maneuver item or stats
 * @returns {boolean}
 */
export function canAffordManeuver(actor, maneuver) {
  const chiCost = maneuver.chiCost ?? maneuver.system?.chiCost ?? 0;
  const willpowerCost = maneuver.willpowerCost ?? maneuver.system?.willpowerCost ?? 0;

  const currentChi = actor.system.resources?.chi?.value ?? 0;
  const currentWillpower = actor.system.resources?.willpower?.value ?? 0;

  return currentChi >= chiCost && currentWillpower >= willpowerCost;
}
