/**
 * Naruto RPG System - Effects Module Index
 * @author Kirlian Silvestre
 */

import { NarutoRpgEffect } from "./effect.mjs";
import { NarutoRpgEffectSheet } from "./effect-sheet.mjs";

export * from "./effect-types.mjs";
export { NarutoRpgEffect, NarutoRpgEffectSheet };

const DocumentSheetConfig = foundry.applications.apps.DocumentSheetConfig;
const ActiveEffectConfig = foundry.applications.sheets.ActiveEffectConfig;

/**
 * Register effect-related configurations
 */
export function registerEffects() {
  CONFIG.ActiveEffect.documentClass = NarutoRpgEffect;

  // Enable legacy transferral for Foundry v13+ to automatically transfer effects from items to actors
  if (!game.version.startsWith("12")) {
    CONFIG.ActiveEffect.legacyTransferral = true;
  }

  DocumentSheetConfig.unregisterSheet(ActiveEffect, "core", ActiveEffectConfig);
  DocumentSheetConfig.registerSheet(ActiveEffect, "naruto-rpg", NarutoRpgEffectSheet, {
    makeDefault: true,
    label: "NARUTO_RPG.SheetLabels.Effect",
  });
}
