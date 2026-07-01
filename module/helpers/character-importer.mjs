/**
 * Naruto RPG Character Importer
 * Imports characters from .fscharacters files exported from Fighter Sheet app
 * @author Kirlian Silvestre
 */

import { findWorldItemBySourceId, addNonOptionalTraitsToActor } from "./utils.mjs";

/**
 * Import characters from a .fscharacters file
 * @param {File} file - The file to import
 * @param {Folder} folder - Optional folder to place characters in
 * @returns {Promise<{success: boolean, counts: object, errors: string[]}>}
 */
export async function importCharacters(file, folder = null) {
  const errors = [];
  const counts = {
    imported: 0,
    updated: 0,
    skipped: 0,
  };

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.characters || !Array.isArray(data.characters)) {
      errors.push("Invalid file format: missing characters array");
      return { success: false, counts, errors };
    }

    const version = data.version || "unknown";

    for (const charData of data.characters) {
      try {
        const result = await importSingleCharacter(charData, version, folder);
        if (result.isUpdate) {
          counts.updated++;
        } else {
          counts.imported++;
        }
      } catch (e) {
        errors.push(`Character ${charData.name || charData.characterId}: ${e.message}`);
      }
    }

    return { success: true, counts, errors };
  } catch (e) {
    errors.push(`Failed to parse file: ${e.message}`);
    return { success: false, counts, errors };
  }
}

/**
 * Import a single character from exported data
 * If a character with the same name exists, update it instead of creating new
 * @param {object} charData - Character data from export
 * @param {string} version - Export version
 * @param {Folder} folder - Optional folder
 * @returns {Promise<{actor: Actor, isUpdate: boolean}>}
 */
async function importSingleCharacter(charData, version, folder) {
  const characterName = charData.name || charData.characterName || "Unnamed Fighter";
  
  // Check if actor with same name already exists
  const existingActor = game.actors.find(a => a.name === characterName);
  
  if (existingActor) {
    // Update existing actor, preserving current resource values
    const currentSystem = existingActor.system;
    const newSystemData = buildActorSystemData(charData, version);
    
    // Preserve current resource values from the existing character (clamped to new max)
    newSystemData.resources.health.value = Math.min(
      currentSystem.resources?.health?.value ?? newSystemData.resources.health.max,
      newSystemData.resources.health.max
    );
    newSystemData.resources.chi.value = Math.min(
      currentSystem.resources?.chi?.value ?? newSystemData.resources.chi.max,
      newSystemData.resources.chi.max
    );
    newSystemData.resources.willpower.value = Math.min(
      currentSystem.resources?.willpower?.value ?? newSystemData.resources.willpower.max,
      newSystemData.resources.willpower.max
    );
    
    // Update actor data
    await existingActor.update({
      img: charData.imageBase64 ? `data:image/png;base64,${charData.imageBase64}` : existingActor.img,
      system: newSystemData,
    });
    
    // Remove all existing embedded items and re-add them
    const existingItemIds = existingActor.items.map(i => i.id);
    if (existingItemIds.length > 0) {
      await existingActor.deleteEmbeddedDocuments("Item", existingItemIds);
    }
    
    // Add embedded items (special maneuvers, weapons, etc.)
    await addEmbeddedItems(existingActor, charData);
    
    return { actor: existingActor, isUpdate: true };
  }
  
  // Create new actor
  const actorData = {
    name: characterName,
    type: "fighter",
    folder: folder?.id || null,
    img: charData.imageBase64 ? `data:image/png;base64,${charData.imageBase64}` : null,
    system: buildActorSystemData(charData, version),
  };

  const actor = await Actor.create(actorData);

  // Add embedded items (special maneuvers, weapons, etc.)
  await addEmbeddedItems(actor, charData);

  return { actor, isUpdate: false };
}

/**
 * Build the system data for an actor from imported character data
 * @param {object} charData - Character data from export
 * @param {string} version - Export version
 * @returns {object} - System data for the actor
 */
function buildActorSystemData(charData, version) {
  return {
    importData: {
      isImported: true,
      characterId: charData.characterId || "",
      importedAt: new Date().toISOString(),
      sourceVersion: version,
    },
    profile: {
      characterName: charData.characterName || charData.name || "",
      playerName: charData.playerName || "",
      chronicleName: charData.chronicleName || "",
      schoolName: charData.schoolName || "",
      fightingTeam: charData.fightingTeam || "",
      stable: charData.stable || "",
      concept: charData.concept || "",
      signature: charData.signature || "",
    },
    resources: {
      health: {
        value: charData.health || 10,
        max: charData.health || 10,
      },
      chi: {
        value: charData.chi || 0,
        max: charData.chi || 0,
      },
      willpower: {
        value: charData.willpower || 0,
        max: charData.willpower || 0,
      },
    },
    renown: {
      honor: {
        permanent: charData.permanentHonor || 0,
        temporary: charData.temporaryHonor || 0,
      },
      glory: {
        permanent: charData.permanentGlory || 0,
        temporary: charData.temporaryGlory || 0,
      },
    },
    experience: {
      total: charData.experienceTotal || 0,
      spent: charData.experienceSpent || 0,
    },
    divisionRecords: charData.divisionRecords || [],
    sessionRecords: charData.sessionRecords || [],
    languages: charData.languages || [],
    combos: charData.combos || [],
    biography: "",
    background: charData.background || "",
    motivations: charData.motivations || "",
    appearanceNotes: charData.appearance || "",
    equipment: charData.equipment || "",
  };
}

/**
 * Add embedded items to an actor based on imported data
 * @param {Actor} actor - The actor to add items to
 * @param {object} charData - Character data from export
 */
async function addEmbeddedItems(actor, charData) {
  const itemsToCreate = [];
  const traitBonuses = new Map(); // Track bonuses from effects

  // Process appliedEffectGroups first to collect trait bonuses and granted maneuvers
  if (charData.appliedEffectGroups && Array.isArray(charData.appliedEffectGroups)) {
    for (const group of charData.appliedEffectGroups) {
      if (!group.effects || !Array.isArray(group.effects)) continue;
      
      for (const effect of group.effects) {
        // Handle traitBonus effects
        if (effect.type === "traitBonus" && effect.targets && Array.isArray(effect.targets)) {
          for (const targetId of effect.targets) {
            const currentBonus = traitBonuses.get(targetId) || 0;
            traitBonuses.set(targetId, currentBonus + (effect.value || 0));
          }
          console.log(`Naruto RPG | Applied traitBonus: ${effect.value} to ${effect.targets.join(", ")}`);
        }
        
        // Handle grantManeuver effects
        if (effect.type === "grantManeuver" && effect.targets && Array.isArray(effect.targets)) {
          for (const maneuverId of effect.targets) {
            const maneuverItem = findWorldItemBySourceId(maneuverId, "specialManeuver");
            if (maneuverItem) {
              // Check if not already added
              const alreadyAdded = itemsToCreate.some(
                i => i.system?.sourceId === maneuverId && i.type === "specialManeuver"
              );
              if (!alreadyAdded) {
                itemsToCreate.push(maneuverItem.toObject());
                console.log(`Naruto RPG | Granted maneuver from effect: ${maneuverId}`);
              }
            }
          }
        }
      }
    }
  }

  // Add fighting style as embedded item
  if (charData.styleId) {
    const styleItem = findWorldItemBySourceId(charData.styleId, "fightingStyle");
    if (styleItem) {
      itemsToCreate.push(styleItem.toObject());
    }
  }

  // Add traits from traitValues as embedded items with their values
  if (charData.traitValues && typeof charData.traitValues === "object") {
    for (const [traitSourceId, value] of Object.entries(charData.traitValues)) {
      // Skip traits with value 0 (unless they have a bonus)
      const bonus = traitBonuses.get(traitSourceId) || 0;
      const totalValue = value + bonus;
      
      if (totalValue === 0) continue;
      
      // Try to find the trait in world items (could be attribute, ability, technique, or background)
      const traitItem = findWorldItemBySourceId(traitSourceId, ["attribute", "ability", "technique", "background"]);
      if (traitItem) {
        const traitData = traitItem.toObject();
        traitData.system.value = totalValue;
        itemsToCreate.push(traitData);
        console.log(`Naruto RPG | Adding trait: ${traitSourceId} with value ${value} + bonus ${bonus} = ${totalValue}`);
      } else {
        console.warn(`Naruto RPG | Trait not found in world items: ${traitSourceId}`);
      }
    }
  }

  // Add special maneuvers from specialManeuverIds (if not already added by effects)
  if (charData.specialManeuverIds && Array.isArray(charData.specialManeuverIds)) {
    for (const maneuverId of charData.specialManeuverIds) {
      // Check if not already added by grantManeuver effect
      const alreadyAdded = itemsToCreate.some(
        i => i.system?.sourceId === maneuverId && i.type === "specialManeuver"
      );
      if (!alreadyAdded) {
        const maneuverItem = findWorldItemBySourceId(maneuverId, "specialManeuver");
        if (maneuverItem) {
          itemsToCreate.push(maneuverItem.toObject());
        }
      }
    }
  }

  // Add weapons
  if (charData.selectedWeaponIds && Array.isArray(charData.selectedWeaponIds)) {
    for (const weaponId of charData.selectedWeaponIds) {
      const weaponItem = findWorldItemBySourceId(weaponId, "weapon");
      if (weaponItem) {
        itemsToCreate.push(weaponItem.toObject());
      }
    }
  }

  // Add division records as division items
  if (charData.divisionRecords && Array.isArray(charData.divisionRecords)) {
    for (const record of charData.divisionRecords) {
      const divisionItem = findWorldItemBySourceId(record.divisionId, "division");
      if (divisionItem) {
        const divisionData = divisionItem.toObject();
        divisionData.system.rank = record.rank || "";
        divisionData.system.wins = record.wins || 0;
        divisionData.system.draws = record.draws || 0;
        divisionData.system.losses = record.losses || 0;
        divisionData.system.knockouts = record.knockouts || 0;
        itemsToCreate.push(divisionData);
      }
    }
  }

  // Create all embedded items
  if (itemsToCreate.length > 0) {
    await actor.createEmbeddedDocuments("Item", itemsToCreate);
  }

  // Add non-optional traits if setting is enabled
  if (game.settings.get("naruto-rpg", "autoAddTraitsOnImport")) {
    const existingSourceIds = new Set(
      itemsToCreate
        .filter(i => ["attribute", "ability", "technique", "background"].includes(i.type))
        .map(i => i.system?.sourceId)
        .filter(Boolean)
    );
    await addNonOptionalTraitsToActor(actor, existingSourceIds);
  }
}

/**
 * Import a character into an existing actor (for player self-import)
 * Validates that the file contains only one character and matches the actor name if already imported
 * @param {File} file - The file to import
 * @param {Actor} targetActor - The actor to import into
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function importCharacterIntoActor(file, targetActor) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.characters || !Array.isArray(data.characters)) {
      return { 
        success: false, 
        error: game.i18n.localize("NARUTO_RPG.Character.invalidFileFormat") 
      };
    }

    // Validate: file must contain exactly one character
    if (data.characters.length !== 1) {
      return { 
        success: false, 
        error: game.i18n.format("NARUTO_RPG.Character.multipleCharactersError", {
          count: data.characters.length
        })
      };
    }

    const charData = data.characters[0];
    const characterName = charData.name || charData.characterName || "Unnamed Fighter";
    const isAlreadyImported = targetActor.system.importData?.isImported || false;

    // If actor was already imported, only allow reimporting the same character (by name)
    if (isAlreadyImported) {
      const existingName = targetActor.name;
      if (existingName !== characterName) {
        return { 
          success: false, 
          error: game.i18n.format("NARUTO_RPG.Character.reimportNameMismatch", {
            expected: existingName,
            found: characterName
          })
        };
      }
    }

    const version = data.version || "unknown";

    // Build system data
    const newSystemData = buildActorSystemData(charData, version);

    // Preserve current resource values if updating (clamped to new max)
    if (isAlreadyImported) {
      const currentSystem = targetActor.system;
      newSystemData.resources.health.value = Math.min(
        currentSystem.resources?.health?.value ?? newSystemData.resources.health.max,
        newSystemData.resources.health.max
      );
      newSystemData.resources.chi.value = Math.min(
        currentSystem.resources?.chi?.value ?? newSystemData.resources.chi.max,
        newSystemData.resources.chi.max
      );
      newSystemData.resources.willpower.value = Math.min(
        currentSystem.resources?.willpower?.value ?? newSystemData.resources.willpower.max,
        newSystemData.resources.willpower.max
      );
    }

    // Update actor data
    await targetActor.update({
      name: characterName,
      img: charData.imageBase64 ? `data:image/png;base64,${charData.imageBase64}` : targetActor.img,
      system: newSystemData,
    });

    // Remove all existing embedded items and re-add them
    const existingItemIds = targetActor.items.map(i => i.id);
    if (existingItemIds.length > 0) {
      await targetActor.deleteEmbeddedDocuments("Item", existingItemIds);
    }

    // Add embedded items (special maneuvers, weapons, etc.)
    await addEmbeddedItems(targetActor, charData);

    return { success: true, error: null };
  } catch (e) {
    console.error("Naruto RPG | Character import error:", e);
    return { 
      success: false, 
      error: game.i18n.format("NARUTO_RPG.Character.importParseError", { message: e.message })
    };
  }
}

/**
 * Show the character import dialog for a specific actor (player self-import)
 * @param {Actor} targetActor - The actor to import into
 */
export async function showPlayerCharacterImportDialog(targetActor) {
  const { DialogV2 } = foundry.applications.api;
  
  const isAlreadyImported = targetActor.system.importData?.isImported || false;
  const hint = isAlreadyImported
    ? game.i18n.format("NARUTO_RPG.Character.reimportHint", { name: targetActor.name })
    : game.i18n.localize("NARUTO_RPG.Character.playerImportHint");
  
  const content = `
    <form>
      <div class="form-group">
        <label>Character File (.fscharacters)</label>
        <input type="file" name="characterFile" accept=".fscharacters,.json" />
      </div>
      <p style="font-size: 11px; color: #888; margin-top: 8px;">
        ${hint}
      </p>
    </form>
  `;

  let fileInput = null;

  await DialogV2.prompt({
    window: {
      title: game.i18n.localize("NARUTO_RPG.Character.importMyCharacter"),
      icon: "fas fa-file-import",
    },
    content,
    render: (event, dialog) => {
      fileInput = dialog.element.querySelector('input[name="characterFile"]');
    },
    ok: {
      label: game.i18n.localize("NARUTO_RPG.Character.import"),
      icon: "fas fa-file-import",
      callback: async () => {
        if (!fileInput?.files.length) {
          ui.notifications.error(game.i18n.localize("NARUTO_RPG.Errors.noFileSelected"));
          return;
        }

        const file = fileInput.files[0];
        ui.notifications.info(game.i18n.format("NARUTO_RPG.Character.importingFile", { name: file.name }));

        const result = await importCharacterIntoActor(file, targetActor);

        if (result.success) {
          ui.notifications.info(game.i18n.localize("NARUTO_RPG.Character.playerImportSuccess"));
        } else {
          ui.notifications.error(result.error);
        }
      },
    },
    rejectClose: false,
  });
}

/**
 * Show the character import dialog
 */
export async function showCharacterImportDialog() {
  const { DialogV2 } = foundry.applications.api;
  
  const content = `
    <form>
      <div class="form-group">
        <label>Character File (.fscharacters)</label>
        <input type="file" name="characterFile" accept=".fscharacters,.json" />
      </div>
      <p style="font-size: 11px; color: #888; margin-top: 8px;">
        Imported characters are read-only and can only be updated by re-importing.
      </p>
    </form>
  `;

  let fileInput = null;

  await DialogV2.prompt({
    window: {
      title: game.i18n.localize("NARUTO_RPG.Character.import"),
      icon: "fas fa-file-import",
    },
    content,
    render: (event, dialog) => {
      fileInput = dialog.element.querySelector('input[name="characterFile"]');
    },
    ok: {
      label: game.i18n.localize("NARUTO_RPG.Character.import"),
      icon: "fas fa-file-import",
      callback: async () => {
        if (!fileInput?.files.length) {
          ui.notifications.error(game.i18n.localize("NARUTO_RPG.Errors.noFileSelected"));
          return;
        }

        const file = fileInput.files[0];
        ui.notifications.info(`Importing characters from: ${file.name}...`);

        const result = await importCharacters(file);

        if (result.success) {
          const parts = [];
          if (result.counts.imported > 0) {
            parts.push(`${result.counts.imported} imported`);
          }
          if (result.counts.updated > 0) {
            parts.push(`${result.counts.updated} updated`);
          }
          ui.notifications.info(
            `${game.i18n.localize("NARUTO_RPG.Character.importSuccess")}: ${parts.join(", ")}`
          );
        }

        if (result.errors.length > 0) {
          console.warn("Character import errors:", result.errors);
          ui.notifications.warn(
            `${game.i18n.localize("NARUTO_RPG.Character.importError")}: ${result.errors.length} errors. Check console for details.`
          );
        }
      },
    },
    rejectClose: false,
  });
}
