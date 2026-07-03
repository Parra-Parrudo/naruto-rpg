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

import { importOfficialContent, showImportDialog } from "./helpers/library-importer.mjs";
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
    importOfficialContent,
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

  const officialButton = createImportButton(
    "nrpg-import-official",
    "NARUTO_RPG.Library.officialImport",
    "fas fa-scroll",
    () => game.narutorpg.importOfficialContent()
  );

  const actionButtons = html.querySelector(".directory-header .action-buttons");
  if (actionButtons) {
    actionButtons.prepend(button);
    actionButtons.prepend(officialButton);
  }
});

/* Condicoes de combate do Naruto RPG como status de token */
Hooks.once("i18nInit", () => {
  const TECHS = ["punch", "kick", "block", "grab", "athletics", "focus", "arremesso", "armas_brancas"];
  const spdAll = (v) => TECHS.map((t) => ({ key: `sf.maneuver.technique.speed.${t}`, mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: `${v}` }));
  const loc = (k) => game.i18n.localize(`NARUTO_RPG.Status.${k}`);

  const conditions = [
    { id: "nrpg-atordoado", name: loc("atordoado"), img: "icons/svg/daze.svg", description: loc("atordoadoDesc") },
    { id: "nrpg-derrubado", name: loc("derrubado"), img: "icons/svg/falling.svg", description: loc("derrubadoDesc"), changes: spdAll(-2), duration: { rounds: 1 } },
    { id: "nrpg-desequilibrado", name: loc("desequilibrado"), img: "icons/svg/downgrade.svg", description: loc("desequilibradoDesc"), changes: spdAll(-2), duration: { rounds: 1 } },
    { id: "nrpg-surpreso", name: loc("surpreso"), img: "icons/svg/hazard.svg", description: loc("surpresoDesc"), changes: spdAll(-2), duration: { rounds: 1 } },
    { id: "nrpg-bloqueando", name: loc("bloqueando"), img: "icons/svg/shield.svg", description: loc("bloqueandoDesc") },
    { id: "nrpg-apresado", name: loc("apresado"), img: "icons/svg/net.svg", description: loc("apresadoDesc") },
    { id: "nrpg-envenenado", name: loc("envenenado"), img: "icons/svg/poison.svg", description: loc("envenenadoDesc") },
    { id: "nrpg-cego", name: loc("cego"), img: "icons/svg/blind.svg", description: loc("cegoDesc") },
    { id: "nrpg-inconsciente", name: loc("inconsciente"), img: "icons/svg/unconscious.svg", description: loc("inconscienteDesc") },
  ];
  const trait = (id, v) => ({ key: `sf.trait.${id}`, mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: `${v}` });
  const soak = (v) => ({ key: "sf.resource.max.soak", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: `${v}` });
  const locB = (k) => game.i18n.localize(`NARUTO_RPG.Status.Bijuu.${k}`);

  const bijuuModes = [
    { id: "nrpg-bijuu-presenca", name: locB("presenca"), img: "icons/svg/eye.svg", description: locB("presencaDesc"),
      changes: [trait("strength", 1), trait("perception", 1)] },
    { id: "nrpg-bijuu-manto", name: locB("manto"), img: "icons/svg/fire.svg", description: locB("mantoDesc"),
      changes: spdAll(2) },
    { id: "nrpg-bijuu-modo", name: locB("modo"), img: "icons/svg/blood.svg", description: locB("modoDesc"),
      changes: [trait("dexterity", 1), soak(1)] },
    { id: "nrpg-bijuu-forma", name: locB("forma"), img: "icons/svg/terror.svg", description: locB("formaDesc"),
      changes: [trait("strength", 8), trait("stamina", 6)] },
    { id: "nrpg-bijuu-chakra", name: locB("chakra"), img: "icons/svg/sun.svg", description: locB("chakraDesc"),
      changes: [trait("strength", 2), trait("dexterity", 2), soak(2)].concat(spdAll(3)) },
  ];

  // Lista curada: remove os status padrão do Foundry que não existem no Naruto RPG
  const keepIds = ["dead", "invisible"];
  const kept = CONFIG.statusEffects.filter((s) => keepIds.includes(s.id));
  CONFIG.statusEffects = kept.concat(conditions).concat(bijuuModes);
  CONFIG.specialStatusEffects.BLIND = "nrpg-cego";
});

/* Oferece a importacao do conteudo oficial na primeira vez que o GM abre o mundo */
Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  if (game.settings.get("naruto-rpg", "officialContentImported")) return;

  const { DialogV2 } = foundry.applications.api;
  const confirmed = await DialogV2.confirm({
    window: { title: game.i18n.localize("NARUTO_RPG.Library.officialImportPromptTitle") },
    content: `<p>${game.i18n.localize("NARUTO_RPG.Library.officialImportPromptContent")}</p>`,
  });
  if (confirmed) {
    await importOfficialContent();
  } else {
    await game.settings.set("naruto-rpg", "officialContentImported", true);
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
