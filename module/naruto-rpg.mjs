/**
 * Naruto RPG System for Foundry VTT v13
 * @author Kirlian Silvestre
 * @version 1.0.0
 */

import { NARUTO_RPG } from "./config/config.mjs";
import { registerSettings } from "./config/settings.mjs";
import { preloadHandlebarsTemplates } from "./helpers/templates.mjs";
import { registerHandlebarsHelpers } from "./helpers/handlebars-helpers.mjs";

import { NarutoRpgActor } from "./documents/actor.mjs";
import { NarutoRpgItem } from "./documents/item.mjs";

import { NarutoRpgActorSheet } from "./sheets/actor-sheet.mjs";
import { NarutoRpgItemSheet } from "./sheets/item-sheet.mjs";

import { NarutoRpgCombat } from "./combat/combat.mjs";
import { NarutoRpgCombatant } from "./combat/combatant.mjs";
import { NarutoRpgCombatTracker } from "./combat/combat-tracker.mjs";
import { registerCombatSockets } from "./combat/combat-socket.mjs";

import { registerEffects } from "./effects/index.mjs";

import { showImportDialog } from "./helpers/library-importer.mjs";
import { showCharacterImportDialog } from "./helpers/character-importer.mjs";
import { executeRoll } from "./dice/roll-dialog.mjs";
import { createImportButton, canInteractWithChatMessage } from "./helpers/utils.mjs";
import { DIFFICULTY } from "./config/constants.mjs";

Hooks.once("init", async () => {
  console.log("Naruto RPG | Initializing Naruto RPG System");

  game.narutorpg = {
    NarutoRpgActor,
    NarutoRpgItem,
    config: NARUTO_RPG,
    showImportDialog,
    showCharacterImportDialog,
  };

  CONFIG.NARUTO_RPG = NARUTO_RPG;

  CONFIG.Actor.typeLabels = NARUTO_RPG.actorTypes;
  CONFIG.Item.typeLabels = NARUTO_RPG.itemTypes;

  CONFIG.Actor.documentClass = NarutoRpgActor;
  CONFIG.Item.documentClass = NarutoRpgItem;
  CONFIG.Combat.documentClass = NarutoRpgCombat;
  CONFIG.Combatant.documentClass = NarutoRpgCombatant;

  CONFIG.ui.combat = NarutoRpgCombatTracker;

  registerEffects();

  // Register sheets using DocumentSheetConfig for V2 applications
  foundry.documents.collections.Actors.registerSheet("naruto-rpg", NarutoRpgActorSheet, {
    types: ["fighter"],
    makeDefault: true,
    label: "NARUTO_RPG.SheetLabels.Actor",
  });

  foundry.documents.collections.Items.registerSheet("naruto-rpg", NarutoRpgItemSheet, {
    makeDefault: true,
    label: "NARUTO_RPG.SheetLabels.Item",
  });

  registerSettings();
  registerHandlebarsHelpers();

  await preloadHandlebarsTemplates();
});

Hooks.once("ready", () => {
  console.log("Naruto RPG | System Ready");

  registerCombatSockets();
});

// Global click handler for chat message accordions
Hooks.on("renderChatMessageHTML", (message, html) => {
  html.querySelectorAll(".nrpg-maneuver-expand-chat").forEach(btn => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const card = btn.closest(".nrpg-maneuver-card-inline");
      if (!card) return;

      const notesSection = card.querySelector(".nrpg-maneuver-notes");
      if (!notesSection) return;

      const isCollapsed = notesSection.classList.contains("collapsed");
      notesSection.classList.toggle("collapsed", !isCollapsed);
      notesSection.classList.toggle("expanded", isCollapsed);

      const icon = btn.querySelector("i");
      if (icon) {
        icon.classList.toggle("fa-chevron-down", !isCollapsed);
        icon.classList.toggle("fa-chevron-up", isCollapsed);
      }
    });
  });
});

Hooks.on("renderItemDirectory", (app, html, data) => {
  if (!game.user.isGM) return;

  const button = createImportButton(
    "nrpg-import-library",
    "NARUTO_RPG.Library.import",
    "fas fa-file-import",
    () => game.narutorpg.showImportDialog()
  );

  const actionButtons = html.querySelector(".directory-header .action-buttons");
  if (actionButtons) {
    actionButtons.prepend(button);
  }
});

Hooks.on("renderActorDirectory", (app, html, data) => {
  if (!game.user.isGM) return;

  const button = createImportButton(
    "nrpg-import-characters",
    "NARUTO_RPG.Character.import",
    "fas fa-file-import",
    () => game.narutorpg.showCharacterImportDialog()
  );

  const actionButtons = html.querySelector(".directory-header .action-buttons");
  if (actionButtons) {
    actionButtons.prepend(button);
  }
});

Hooks.on("renderChatMessageHTML", (message, html, data) => {
  const canInteract = canInteractWithChatMessage(message);

  // Hide interactive buttons for non-owners/non-GMs
  if (!canInteract) {
    html.querySelectorAll(".reroll-button, .apply-damage-button, .card-buttons button").forEach(btn => {
      btn.style.display = "none";
    });
  }

  // Apply Damage button handler
  const applyDamageButton = html.querySelector(".apply-damage-button");
  if (applyDamageButton) {
    applyDamageButton.addEventListener("click", async (event) => {
      event.preventDefault();
      const card = html.querySelector(".roll-result");
      if (!card) return;

      const targetTokenId = card.dataset.targetTokenId;
      const targetActorId = card.dataset.targetActorId;
      const damage = parseInt(card.dataset.damage) || 0;

      if ((!targetActorId && !targetTokenId) || damage <= 0) {
        ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Roll.noDamageToApply"));
        return;
      }

      // Try to get the token's actor first (for synthetic/unlinked tokens)
      // Fall back to the base actor if no token is found
      let targetActor = null;
      if (targetTokenId) {
        const token = canvas.tokens?.get(targetTokenId);
        if (token?.actor) {
          targetActor = token.actor;
        }
      }
      
      // Fallback to base actor if token not found
      if (!targetActor && targetActorId) {
        targetActor = game.actors.get(targetActorId);
      }

      if (!targetActor) {
        ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Errors.actorNotFound"));
        return;
      }

      await targetActor.applyDamage(damage);
      
      ui.notifications.info(
        game.i18n.format("NARUTO_RPG.Roll.damageApplied", { 
          damage: damage, 
          name: targetActor.name 
        })
      );

      // Disable button after use
      applyDamageButton.disabled = true;
      applyDamageButton.classList.add("applied");
    });
  }

  const rerollButton = html.querySelector(".reroll-button");
  if (!rerollButton) return;

  rerollButton.addEventListener("click", async (event) => {
    event.preventDefault();
    const card = html.querySelector(".roll-result");
    if (!card) return;

    const actorId = card.dataset.actorId;
    const attributeId = card.dataset.attributeId;
    const secondTraitId = card.dataset.secondTraitId;
    const difficulty = parseInt(card.dataset.difficulty) || DIFFICULTY.default;
    const modifier = parseInt(card.dataset.modifier) || 0;
    const dicePool = parseInt(card.dataset.dicePool) || 0;
    const rollTitle = card.dataset.rollTitle || null;
    const targetTokenId = card.dataset.targetTokenId || null;
    const targetActorId = card.dataset.targetActorId || null;
    const targetName = card.dataset.targetName || null;
    const attributeValue = parseInt(card.dataset.attributeValue) || 0;
    const attributeName = card.dataset.attributeName || null;
    const secondTraitValue = parseInt(card.dataset.secondTraitValue) || 0;
    const secondTraitName = card.dataset.secondTraitName || null;
    const secondTraitType = card.dataset.secondTraitType || null;
    const isDamageRoll = card.dataset.isDamageRoll === "true";

    // Parse modifiers from JSON
    let fixedModifiers = [];
    let effectModifiers = [];
    try {
      const fixedModifiersStr = card.dataset.fixedModifiers;
      const effectModifiersStr = card.dataset.effectModifiers;
      if (fixedModifiersStr) fixedModifiers = JSON.parse(fixedModifiersStr);
      if (effectModifiersStr) effectModifiers = JSON.parse(effectModifiersStr);
    } catch (e) {
      console.warn("Naruto RPG | Failed to parse modifiers for reroll", e);
    }

    const actor = game.actors.get(actorId);
    if (!actor) {
      ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Errors.actorNotFound"));
      return;
    }

    const rollData = {
      actor,
      attribute: attributeId ? { id: attributeId, name: attributeName, value: attributeValue } : null,
      secondTrait: secondTraitId ? { id: secondTraitId, name: secondTraitName, value: secondTraitValue, type: secondTraitType } : null,
      difficulty,
      modifier,
      fixedModifiers,
      effectModifiers,
      dicePool: Math.max(0, dicePool),
      rollTitle,
      targetTokenId,
      targetActorId,
      targetName,
      isDamageRoll,
    };

    await executeRoll(rollData);
  });
});
