/**
 * Naruto RPG Roll Dialog
 * @author Kirlian Silvestre
 */

import { DIFFICULTY, clampDifficulty } from "../config/constants.mjs";
import { getEffectiveTraitValue } from "../helpers/effect-helpers.mjs";

const { DialogV2 } = foundry.applications.api;

export class NarutoRpgRollDialog extends DialogV2 {
  /**
   * Create and display a roll dialog
   * @param {Actor} actor - The actor making the roll
   * @param {object} options - Dialog options
   * @param {string} options.selectedTraitId - Pre-selected trait ID
   * @param {string} options.selectedTraitType - Type of pre-selected trait (attribute, ability, etc.)
   * @param {string} options.rollTitle - Custom title for the roll
   * @returns {Promise<object|null>} Roll data or null if cancelled
   */
  static async create(actor, options = {}) {
    const dialogData = this._prepareDialogData(actor, options);
    const content = await foundry.applications.handlebars.renderTemplate(
      "systems/naruto-rpg/templates/dialog/roll-dialog.hbs",
      dialogData
    );

    let formData = null;
    let dialogElement = null;
    
    // Build dialog title
    const dialogTitle = options.rollTitle || game.i18n.localize("NARUTO_RPG.Roll.title");

    try {
      const result = await DialogV2.prompt({
        window: { 
          title: dialogTitle,
          icon: "fas fa-dice-d10",
        },
        classes: ["naruto-rpg", "roll-dialog-window"],
        content: content,
        render: (event, dialog) => {
          dialogElement = dialog.element;
          this._setupDialogListeners(dialog.element, actor, options.isDamageRoll || false);
        },
        ok: {
          action: "roll",
          label: game.i18n.localize("NARUTO_RPG.Roll.roll"),
          icon: "fas fa-dice",
          callback: (event, button, dialog) => {
            dialogElement = dialog.element;
            const form = dialog.element.querySelector("form");
            if (form) {
              formData = new FormData(form);
            }
            return formData;
          },
        },
        rejectClose: false,
      });

      if (!formData) return null;

      return this._processFormData(formData, actor, dialogElement, options);
    } catch (error) {
      console.error("Error in roll dialog:", error);
      return null;
    }
  }

  /**
   * Prepare data for the dialog template
   * @param {Actor} actor
   * @param {object} options
   * @returns {object}
   * @private
   */
  static _prepareDialogData(actor, options) {
    const attributes = [];
    const abilities = [];
    const techniques = [];
    const backgrounds = [];

    for (const item of actor.items) {
      const sourceId = item.system.sourceId;
      const baseValue = item.system.value || 0;
      const effective = getEffectiveTraitValue(actor, sourceId, baseValue);
      
      const itemData = {
        id: item.id,
        name: item.name,
        system: item.system,
        effectiveValue: effective.value,
        baseValue: baseValue,
        hasModifiers: effective.hasModifiers,
        selected: item.id === options.selectedTraitId,
        secondSelected: item.id === options.preSelectedSecondTrait,
      };

      switch (item.type) {
        case "attribute":
          if (options.selectedTraitType === "attribute" && item.id === options.selectedTraitId) {
            itemData.selected = true;
          }
          attributes.push(itemData);
          break;
        case "ability":
          if (options.selectedTraitType === "ability" && item.id === options.selectedTraitId) {
            itemData.selected = true;
          }
          if (item.id === options.preSelectedSecondTrait) {
            itemData.secondSelected = true;
          }
          abilities.push(itemData);
          break;
        case "technique":
          if (options.selectedTraitType === "technique" && item.id === options.selectedTraitId) {
            itemData.selected = true;
          }
          if (item.id === options.preSelectedSecondTrait) {
            itemData.secondSelected = true;
          }
          techniques.push(itemData);
          break;
        case "background":
          if (options.selectedTraitType === "background" && item.id === options.selectedTraitId) {
            itemData.selected = true;
          }
          if (item.id === options.preSelectedSecondTrait) {
            itemData.secondSelected = true;
          }
          backgrounds.push(itemData);
          break;
      }
    }

    // Sort alphabetically
    const sortByName = (a, b) => a.name.localeCompare(b.name);
    attributes.sort(sortByName);
    abilities.sort(sortByName);
    techniques.sort(sortByName);
    backgrounds.sort(sortByName);

    // Collect active effect modifiers for rolls
    const effectModifiers = this._collectEffectModifiers(actor, attributes, abilities, techniques, backgrounds, options);

    // Prepare fixed modifiers (from maneuvers, weapons, etc.)
    const fixedModifiers = [];
    if (options.maneuverDamageModifier !== undefined && options.maneuverDamageModifier !== null) {
      const modValue = parseInt(options.maneuverDamageModifier);
      if (!isNaN(modValue)) {
        fixedModifiers.push({
          name: options.maneuverName || game.i18n.localize("NARUTO_RPG.Roll.maneuverDamage"),
          value: modValue,
          displayValue: modValue >= 0 ? `+${modValue}` : `${modValue}`,
          checked: true,
        });
      }
    }
    
    // Add equipped weapons as fixed modifiers
    if (options.equippedWeapons && Array.isArray(options.equippedWeapons)) {
      for (const weapon of options.equippedWeapons) {
        const modValue = weapon.damageMod || 0;
        fixedModifiers.push({
          name: weapon.name,
          value: modValue,
          displayValue: modValue >= 0 ? `+${modValue}` : `${modValue}`,
          checked: weapon.selected || false,
          isWeapon: true,
          weaponId: weapon.id,
        });
      }
    }
    
    // Add target's soak as negative modifier
    if (options.targetSoak !== null && options.targetSoak !== undefined && options.targetSoak > 0) {
      const soakValue = -options.targetSoak;
      const targetLabel = options.targetName 
        ? game.i18n.format("NARUTO_RPG.Roll.targetSoak", { name: options.targetName })
        : game.i18n.localize("NARUTO_RPG.Combat.soak");
      fixedModifiers.push({
        name: targetLabel,
        value: soakValue,
        displayValue: `${soakValue}`,
        checked: true,
        isTargetSoak: true,
      });
    }

    return {
      actor,
      attributes,
      abilities,
      techniques,
      backgrounds,
      effectModifiers,
      fixedModifiers,
      difficulty: DIFFICULTY.default,
      selectedTraitType: options.selectedTraitType,
      preSelectedSecondTrait: options.preSelectedSecondTrait,
      isDamageRoll: options.isDamageRoll || false,
    };
  }

  /**
   * Collect effect modifiers applicable to the roll
   * @param {Actor} actor
   * @param {Array} attributes
   * @param {Array} abilities
   * @param {Array} techniques
   * @param {Array} backgrounds
   * @param {object} options
   * @returns {Array}
   * @private
   */
  static _collectEffectModifiers(actor, attributes, abilities, techniques, backgrounds, options) {
    const modifiers = [];

    // Collect trait sourceIds that might be selected
    const traitSourceIds = [];
    
    // Add pre-selected traits
    if (options.selectedTraitId) {
      const selectedItem = actor.items.get(options.selectedTraitId);
      if (selectedItem?.system.sourceId) {
        traitSourceIds.push(selectedItem.system.sourceId);
      }
    }
    if (options.preSelectedSecondTrait) {
      const secondItem = actor.items.get(options.preSelectedSecondTrait);
      if (secondItem?.system.sourceId) {
        traitSourceIds.push(secondItem.system.sourceId);
      }
    }

    // Get roll modifiers from actor
    const rollMods = actor.getRollModifiers(traitSourceIds);

    for (const mod of rollMods) {
      modifiers.push({
        name: mod.name,
        value: mod.value,
        displayValue: mod.value >= 0 ? `+${mod.value}` : `${mod.value}`,
        effectId: mod.effectId,
        isGlobal: mod.isGlobal,
        traitSourceId: mod.traitSourceId || null,
        checked: true,
      });
    }

    return modifiers;
  }

  /**
   * Process form data into roll parameters
   * @param {FormData} formData
   * @param {Actor} actor
   * @param {HTMLElement} dialogElement
   * @param {object} options - Dialog options
   * @returns {object}
   * @private
   */
  static _processFormData(formData, actor, dialogElement, options) {
    const rollTitle = options.rollTitle;
    const attributeId = formData.get("attribute");
    const secondTraitId = formData.get("secondTrait");
    const rawDifficulty = parseInt(formData.get("difficulty")) || DIFFICULTY.default;
    const difficulty = clampDifficulty(rawDifficulty);
    const modifier = parseInt(formData.get("modifier")) || 0;

    // Calculate fixed modifiers from checked checkboxes
    let fixedModifierTotal = 0;
    if (dialogElement) {
      const fixedModCheckboxes = dialogElement.querySelectorAll('.fixed-modifier-item input[type="checkbox"]:checked');
      fixedModCheckboxes.forEach(cb => {
        const value = parseInt(cb.dataset.value) || 0;
        fixedModifierTotal += value;
      });
    }

    // Calculate effect modifiers from checked checkboxes
    let effectModifierTotal = 0;
    if (dialogElement) {
      const effectModCheckboxes = dialogElement.querySelectorAll('.effect-modifier-item input[type="checkbox"]:checked');
      effectModCheckboxes.forEach(cb => {
        const value = parseInt(cb.dataset.value) || 0;
        effectModifierTotal += value;
      });
    }

    const attribute = actor.items.get(attributeId);
    const secondTrait = actor.items.get(secondTraitId);

    // Get effective values (with trait modifiers applied)
    let attributeValue = 0;
    if (attribute) {
      const attrEffective = getEffectiveTraitValue(actor, attribute.system.sourceId, attribute.system.value || 0);
      attributeValue = attrEffective.value;
    }
    
    let secondTraitValue = 0;
    if (secondTrait) {
      const traitEffective = getEffectiveTraitValue(actor, secondTrait.system.sourceId, secondTrait.system.value || 0);
      secondTraitValue = traitEffective.value;
    }
    
    const totalModifier = modifier + fixedModifierTotal + effectModifierTotal;
    const dicePool = attributeValue + secondTraitValue + totalModifier;

    // Collect active fixed modifiers for chat display
    const activeFixedModifiers = [];
    if (dialogElement) {
      const fixedModCheckboxes = dialogElement.querySelectorAll('.fixed-modifier-item input[type="checkbox"]:checked');
      fixedModCheckboxes.forEach(cb => {
        const label = cb.nextElementSibling?.textContent?.trim() || "";
        // Extract name from "Name (+2)" format
        const match = label.match(/^(.+?)\s*\([^)]+\)$/);
        const name = match ? match[1].trim() : label;
        const value = parseInt(cb.dataset.value) || 0;
        if (value !== 0) {
          activeFixedModifiers.push({ name, value, displayValue: value >= 0 ? `+${value}` : `${value}` });
        }
      });
    }

    // Collect active effect modifiers for chat display
    const activeEffectModifiers = [];
    if (dialogElement) {
      const effectModCheckboxes = dialogElement.querySelectorAll('.effect-modifier-item input[type="checkbox"]:checked');
      effectModCheckboxes.forEach(cb => {
        const label = cb.nextElementSibling?.textContent?.trim() || "";
        const match = label.match(/^(.+?)\s*\([^)]+\)$/);
        const name = match ? match[1].trim() : label;
        const value = parseInt(cb.dataset.value) || 0;
        if (value !== 0) {
          activeEffectModifiers.push({ name, value, displayValue: value >= 0 ? `+${value}` : `${value}` });
        }
      });
    }

    // Get target info only for damage rolls (maneuvers)
    let targetTokenId = null;
    let targetActorId = null;
    let targetName = null;
    const isDamageRoll = options.isDamageRoll || false;
    
    if (isDamageRoll) {
      const firstTarget = game.user.targets.first();
      if (firstTarget?.actor) {
        targetTokenId = firstTarget.id;
        targetActorId = firstTarget.actor.id;
        targetName = firstTarget.actor.name;
      }
    }

    return {
      actor,
      attribute: attribute ? { id: attribute.id, name: attribute.name, value: attributeValue } : null,
      secondTrait: secondTrait ? { id: secondTrait.id, name: secondTrait.name, value: secondTraitValue, type: secondTrait.type } : null,
      difficulty,
      modifier,
      fixedModifiers: activeFixedModifiers,
      effectModifiers: activeEffectModifiers,
      dicePool: Math.max(options.isDamageRoll ? 1 : 0, dicePool),
      rollTitle,
      targetTokenId,
      targetActorId,
      targetName,
      isDamageRoll,
    };
  }

  /**
   * Setup event listeners for the dialog
   * @param {HTMLElement} html
   * @param {Actor} actor
   * @private
   */
  static _setupDialogListeners(html, actor, isDamageRoll = false) {
    if (!html) return;
    
    const attributeSelect = html.querySelector('select[name="attribute"]');
    const secondTraitSelect = html.querySelector('select[name="secondTrait"]');
    const modifierInput = html.querySelector('input[name="modifier"]');
    const difficultyInput = html.querySelector('input[name="difficulty"]');
    const poolDisplay = html.querySelector("#dicePoolTotal");
    const fixedModCheckboxes = html.querySelectorAll('.fixed-modifier-item input[type="checkbox"]');
    const effectModifiersContainer = html.querySelector('.roll-effect-modifiers');
    
    if (!difficultyInput) return;

    // Function to get selected trait sourceIds
    const getSelectedTraitSourceIds = () => {
      const sourceIds = [];
      
      const attrId = attributeSelect?.value;
      if (attrId) {
        const attr = actor.items.get(attrId);
        if (attr?.system.sourceId) sourceIds.push(attr.system.sourceId);
      }
      
      const traitId = secondTraitSelect?.value;
      if (traitId) {
        const trait = actor.items.get(traitId);
        if (trait?.system.sourceId) sourceIds.push(trait.system.sourceId);
      }
      
      return sourceIds;
    };

    // Function to update effect modifiers based on selected traits
    const updateEffectModifiers = () => {
      if (!effectModifiersContainer) return;
      
      const traitSourceIds = getSelectedTraitSourceIds();
      const rollMods = actor.getRollModifiers(traitSourceIds);
      
      // Build new effect modifiers list
      let html = `<label>${game.i18n.localize("NARUTO_RPG.Roll.activeEffects")}</label>
        <ul class="effect-modifier-list">`;
      
      for (let i = 0; i < rollMods.length; i++) {
        const mod = rollMods[i];
        const displayValue = mod.value >= 0 ? `+${mod.value}` : `${mod.value}`;
        html += `<li class="effect-modifier-item">
          <input type="checkbox" name="effectMod-${i}" id="effectMod-${i}" data-value="${mod.value}" checked />
          <label for="effectMod-${i}">${mod.name} (${displayValue})</label>
        </li>`;
      }
      
      html += `</ul>`;
      
      if (rollMods.length > 0) {
        effectModifiersContainer.innerHTML = html;
        effectModifiersContainer.style.display = "";
        
        // Re-attach listeners to new checkboxes
        const newCheckboxes = effectModifiersContainer.querySelectorAll('input[type="checkbox"]');
        newCheckboxes.forEach(cb => {
          cb.addEventListener("change", updatePool);
        });
      } else {
        effectModifiersContainer.style.display = "none";
      }
    };

    const updatePool = () => {
      const attrOption = attributeSelect?.selectedOptions[0];
      const traitOption = secondTraitSelect?.selectedOptions[0];
      const modifier = parseInt(modifierInput?.value) || 0;

      // Calculate fixed modifiers from checked checkboxes
      let fixedModTotal = 0;
      fixedModCheckboxes.forEach(cb => {
        if (cb.checked) {
          fixedModTotal += parseInt(cb.dataset.value) || 0;
        }
      });

      // Calculate effect modifiers from checked checkboxes (re-query as they may have changed)
      let effectModTotal = 0;
      const currentEffectCheckboxes = html.querySelectorAll('.effect-modifier-item input[type="checkbox"]');
      currentEffectCheckboxes.forEach(cb => {
        if (cb.checked) {
          effectModTotal += parseInt(cb.dataset.value) || 0;
        }
      });

      const attrValue = parseInt(attrOption?.dataset.value) || 0;
      const traitValue = parseInt(traitOption?.dataset.value) || 0;

      const total = Math.max(isDamageRoll ? 1 : 0, attrValue + traitValue + modifier + fixedModTotal + effectModTotal);
      poolDisplay.textContent = total;
    };

    const onTraitChange = () => {
      updateEffectModifiers();
      updatePool();
    };

    const clampDifficultyInput = () => {
      let value = parseInt(difficultyInput.value);
      if (isNaN(value)) return;
      if (value < DIFFICULTY.min) difficultyInput.value = DIFFICULTY.min;
      if (value > DIFFICULTY.max) difficultyInput.value = DIFFICULTY.max;
    };

    attributeSelect?.addEventListener("change", onTraitChange);
    secondTraitSelect?.addEventListener("change", onTraitChange);
    modifierInput?.addEventListener("input", updatePool);
    
    // Fixed modifier checkboxes
    fixedModCheckboxes.forEach(cb => {
      cb.addEventListener("change", updatePool);
    });

    // Initial effect modifier checkboxes
    const effectModCheckboxes = html.querySelectorAll('.effect-modifier-item input[type="checkbox"]');
    effectModCheckboxes.forEach(cb => {
      cb.addEventListener("change", updatePool);
    });
    
    // Multiple events to catch all input methods
    difficultyInput?.addEventListener("input", clampDifficultyInput);
    difficultyInput?.addEventListener("change", clampDifficultyInput);
    difficultyInput?.addEventListener("keyup", clampDifficultyInput);

    // Initial update
    updatePool();
  }
}

/**
 * Execute a Naruto RPG dice roll
 * @param {object} rollData - Data from the roll dialog
 * @returns {Promise<void>}
 */
export async function executeRoll(rollData) {
  if (!rollData) {
    ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Roll.noDice"));
    return;
  }

  // Ensure minimum 1 die for damage rolls, 0 check for other rolls
  if (rollData.dicePool <= 0 && !rollData.isDamageRoll) {
    ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Roll.noDice"));
    return;
  }

  const { actor, attribute, secondTrait, difficulty, modifier, fixedModifiers, effectModifiers, dicePool, rollTitle, targetTokenId, targetActorId, targetName, isDamageRoll } = rollData;

  // Get system settings
  const onesRemoveSuccesses = game.settings.get("naruto-rpg", "onesRemoveSuccesses");
  const criticalFailureRule = game.settings.get("naruto-rpg", "criticalFailureRule");

  // Roll the dice
  const roll = new Roll(`${dicePool}d10`);
  await roll.evaluate();

  // Process results
  const dice = roll.terms[0].results.map(r => r.result);
  let successes = 0;
  let ones = 0;

  const diceResults = dice.map(die => {
    const isSuccess = die >= difficulty;
    const isOne = die === 1;
    const isTen = die === 10;

    if (isSuccess) successes++;
    if (isOne) ones++;

    return {
      value: die,
      isSuccess,
      isOne,
      isTen,
      cssClass: isSuccess ? "success" : (isOne ? "failure" : ""),
    };
  });

  // Apply ones removing successes
  let finalSuccesses = successes;
  let onesRemoved = 0;
  if (onesRemoveSuccesses && ones > 0) {
    onesRemoved = Math.min(ones, successes);
    finalSuccesses = successes - onesRemoved;
  }

  // Determine critical failure
  let isCriticalFailure = false;
  if (criticalFailureRule === "moreOnesThanSuccesses") {
    isCriticalFailure = ones > successes && finalSuccesses <= 0;
  } else if (criticalFailureRule === "onesWithNoSuccesses") {
    isCriticalFailure = ones > 0 && successes === 0;
  }

  // Determine result type
  let resultType = "failure";
  let resultLabel = game.i18n.localize("NARUTO_RPG.Roll.failure");
  
  if (isCriticalFailure) {
    resultType = "criticalFailure";
    resultLabel = game.i18n.localize("NARUTO_RPG.Roll.criticalFailure");
  } else if (finalSuccesses > 0) {
    resultType = "success";
    resultLabel = game.i18n.format("NARUTO_RPG.Roll.successCount", { count: finalSuccesses });
  }

  // Build chat message content
  const chatData = {
    actor,
    attribute,
    secondTrait,
    difficulty,
    modifier,
    fixedModifiers: fixedModifiers || [],
    effectModifiers: effectModifiers || [],
    hasModifiers: (fixedModifiers?.length > 0) || (effectModifiers?.length > 0),
    dicePool,
    diceResults,
    successes,
    ones,
    onesRemoved,
    finalSuccesses,
    resultType,
    resultLabel,
    onesRemoveSuccesses,
    isCriticalFailure,
    rollTitle: rollTitle || game.i18n.localize("NARUTO_RPG.Roll.title"),
    targetTokenId,
    targetActorId,
    targetName,
    isDamageRoll: isDamageRoll || false,
    canApplyDamage: isDamageRoll && finalSuccesses > 0 && targetActorId,
  };

  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/naruto-rpg/templates/chat/roll-result.hbs",
    chatData
  );

  // Create chat message
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    rolls: [roll],
    sound: CONFIG.sounds.dice,
  });
}
