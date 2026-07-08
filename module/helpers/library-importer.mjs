/**
 * Library Importer for Naruto RPG
 * Imports .fslibrary files (JSON format) and creates Foundry items
 * @author Kirlian Silvestre
 */

import { findWorldItemBySourceId, getWorldItemId, createActiveEffectsFromData } from "./utils.mjs";

/**
 * Import a .fslibrary file and create items in Foundry
 * Uses library name from JSON as main folder, creates subfolders by item type
 * @param {File} file - The .fslibrary file to import
 * @returns {Promise<{success: boolean, counts: object, errors: string[]}>}
 */
export async function importLibrary(file) {
  const text = await file.text();
  let library;
  try {
    library = JSON.parse(text);
  } catch (e) {
    return { success: false, counts: {}, errors: [`Failed to parse library file: ${e.message}`] };
  }
  return importLibraryData(library, file.name);
}

/**
 * Import a parsed library object and create Foundry items
 * Skips items whose sourceId already exists in the world
 */
export async function importLibraryData(library, fallbackName = "Library") {
  const errors = [];
  const counts = {
    fightingStyles: 0,
    specialManeuvers: 0,
    attributes: 0,
    abilities: 0,
    techniques: 0,
    backgrounds: 0,
    weapons: 0,
    divisions: 0,
    equipment: 0,
    clans: 0,
    skipped: 0,
  };

  try {

    // Use library name from JSON as main folder
    const libraryName = library.name || fallbackName.replace(/\.[^/.]+$/, "");
    const exists = (id, types) => id && findWorldItemBySourceId(id, types);
    const mainFolder = await getOrCreateFolder(libraryName);

    // Create subfolders for each item type
    const loc = (k) => game.i18n.localize(k);
    const folders = {
      attributes: await getOrCreateSubfolder(loc("NARUTO_RPG.Library.Folders.attributes"), mainFolder),
      abilitys: await getOrCreateSubfolder(loc("NARUTO_RPG.Library.Folders.abilities"), mainFolder),
      techniques: await getOrCreateSubfolder(loc("NARUTO_RPG.Library.Folders.techniques"), mainFolder),
      backgrounds: await getOrCreateSubfolder(loc("NARUTO_RPG.Library.Folders.backgrounds"), mainFolder),
      divisions: await getOrCreateSubfolder(loc("NARUTO_RPG.Library.Folders.divisions"), mainFolder),
      fightingStyles: await getOrCreateSubfolder(loc("NARUTO_RPG.Library.Folders.fightingStyles"), mainFolder),
      specialManeuvers: await getOrCreateSubfolder(loc("NARUTO_RPG.Library.Folders.specialManeuvers"), mainFolder),
      weapons: await getOrCreateSubfolder(loc("NARUTO_RPG.Library.Folders.weapons"), mainFolder),
      equipment: await getOrCreateSubfolder(loc("NARUTO_RPG.Library.Folders.equipment"), mainFolder),
      clans: await getOrCreateSubfolder(loc("NARUTO_RPG.Library.Folders.clans"), mainFolder),
    };

    // PHASE 1: Import traits FIRST (attributes, abilities, techniques, backgrounds)
    // These are needed for linking in other items
    if (library.traits && Array.isArray(library.traits)) {
      for (const trait of library.traits) {
        try {
          if (exists(trait.id, ["attribute", "ability", "technique", "background"])) { counts.skipped++; continue; }
          const itemType = await createTraitItem(trait, folders);
          // Map itemType to correct count key (ability -> abilities, not abilitys)
          const countKey = itemType === "ability" ? "abilities" : itemType + "s";
          counts[countKey]++;
        } catch (e) {
          errors.push(`Trait ${trait.id}: ${e.message}`);
        }
      }
    }

    // PHASE 2: Import divisions
    if (library.divisions && Array.isArray(library.divisions)) {
      for (const division of library.divisions) {
        try {
          if (exists(division.id, "division")) { counts.skipped++; continue; }
          await createDivisionItem(division, folders.divisions);
          counts.divisions++;
        } catch (e) {
          errors.push(`Division ${division.id}: ${e.message}`);
        }
      }
    }

    // PHASE 3: Import fighting styles
    if (library.fighting_styles && Array.isArray(library.fighting_styles)) {
      for (const style of library.fighting_styles) {
        try {
          if (exists(style.id, "fightingStyle")) { counts.skipped++; continue; }
          await createFightingStyleItem(style, folders.fightingStyles);
          counts.fightingStyles++;
        } catch (e) {
          errors.push(`Fighting Style ${style.id}: ${e.message}`);
        }
      }
    }

    // PHASE 3b: Import clans
    if (library.clans && Array.isArray(library.clans)) {
      for (const clan of library.clans) {
        try {
          if (exists(clan.id, "clan")) { counts.skipped++; continue; }
          await createClanItem(clan, folders.clans);
          counts.clans++;
        } catch (e) {
          errors.push(`Clan ${clan.id}: ${e.message}`);
        }
      }
    }

    // PHASE 4: Import special maneuvers (links to techniques, traits, styles, backgrounds)
    if (library.special_maneuvers && Array.isArray(library.special_maneuvers)) {
      for (const maneuver of library.special_maneuvers) {
        try {
          if (exists(maneuver.id, "specialManeuver")) { counts.skipped++; continue; }
          const catKey = maneuver.category || "other";
          const catLabel = game.i18n.localize(CONFIG.NARUTO_RPG.maneuverCategories?.[catKey] ?? "NARUTO_RPG.Maneuver.Categories.other");
          const catFolder = await getOrCreateSubfolder(catLabel, folders.specialManeuvers);
          await createSpecialManeuverItem(maneuver, catFolder);
          counts.specialManeuvers++;
        } catch (e) {
          errors.push(`Special Maneuver ${maneuver.id}: ${e.message}`);
        }
      }
    }

    // PHASE 5: Import weapons (links to techniques)
    if (library.weapons && Array.isArray(library.weapons)) {
      for (const weapon of library.weapons) {
        try {
          if (exists(weapon.id, "weapon")) { counts.skipped++; continue; }
          await createWeaponItem(weapon, folders.weapons);
          counts.weapons++;
        } catch (e) {
          errors.push(`Weapon ${weapon.id}: ${e.message}`);
        }
      }
    }

    // PHASE 6: Import equipment
    if (library.equipment && Array.isArray(library.equipment)) {
      for (const eq of library.equipment) {
        try {
          if (exists(eq.id, "equipment")) { counts.skipped++; continue; }
          await createEquipmentItem(eq, folders.equipment);
          counts.equipment++;
        } catch (e) {
          errors.push(`Equipment ${eq.id}: ${e.message}`);
        }
      }
    }

    return { success: true, counts, errors, libraryName };
  } catch (e) {
    errors.push(`Failed to import library: ${e.message}`);
    return { success: false, counts, errors };
  }
}

/**
 * Create an Equipment item from library data
 */
async function createRawActiveEffects(item, data) {
  if (Array.isArray(data.active_effects) && data.active_effects.length) {
    await item.createEmbeddedDocuments("ActiveEffect", data.active_effects);
  }
}

async function createEquipmentItem(data, folder) {
  await Item.create({
    name: data.name,
    type: "equipment",
    folder: folder,
    sort: data.sort ?? 0,
    system: {
      sourceId: data.id,
      description: data.description || "",
    },
  });
}

/**
 * Import the official Naruto RPG content bundled with the system
 * (characteristics, styles, ranks, weapons, equipment and rules journal)
 */
export async function importOfficialContent({ silent = false } = {}) {
  const response = await fetch("systems/naruto-rpg/data/conteudo-oficial.json");
  if (!response.ok) {
    ui.notifications.error(game.i18n.localize("NARUTO_RPG.Library.officialImportError"));
    return { success: false };
  }
  const data = await response.json();
  const result = await importLibraryData(data.library, "Naruto RPG");

  // Rules journal (creates it, or adds any missing pages to an existing one)
  if (data.journal) {
    const existing = game.journal.find(j => j.name === data.journal.name);
    if (!existing) {
      await JournalEntry.create({
        name: data.journal.name,
        pages: data.journal.pages.map((p, i) => ({
          name: p.name,
          type: "text",
          sort: (i + 1) * 100,
          text: { format: 1, content: p.content },
        })),
      });
    } else {
      const missing = data.journal.pages.filter(p => !existing.pages.find(ep => ep.name === p.name));
      if (missing.length) {
        await existing.createEmbeddedDocuments("JournalEntryPage", missing.map((p, i) => ({
          name: p.name,
          type: "text",
          sort: (existing.pages.size + i + 1) * 100,
          text: { format: 1, content: p.content },
        })));
      }
    }
  }

  await game.settings.set("naruto-rpg", "officialContentImported", true);
  if (!silent) {
    const total = Object.entries(result.counts).filter(([k]) => k !== "skipped").reduce((a, [, v]) => a + v, 0);
    ui.notifications.info(game.i18n.format("NARUTO_RPG.Library.officialImportDone", { count: total, skipped: result.counts.skipped ?? 0 }));
  }
  return result;
}

/**
 * Get or create a folder for items
 * @param {string} name - Folder name
 * @param {Folder} parent - Optional parent folder
 * @returns {Promise<Folder>}
 */
async function getOrCreateFolder(name, parent = null) {
  const parentId = parent?.id || null;
  let folder = game.folders.find(f => {
    const folderId = f.folder?.id ?? f.folder ?? null;
    return f.name === name && f.type === "Item" && folderId === parentId;
  });
  if (!folder) {
    folder = await Folder.create({ name, type: "Item", folder: parentId });
  }
  return folder;
}

/**
 * Get or create a subfolder inside a parent folder
 * @param {string} name - Subfolder name
 * @param {Folder} parent - Parent folder
 * @returns {Promise<Folder>}
 */
async function getOrCreateSubfolder(name, parent) {
  return getOrCreateFolder(name, parent);
}


/**
 * Create a Division item from library data
 * @param {object} data - Division data from library
 * @param {Folder} folder - Folder to place item in
 */
async function createClanItem(data, folder) {
  const itemData = {
    name: data.name,
    type: "clan",
    folder: folder?.id || folder,
    sort: data.sort ?? 0,
    system: {
      sourceId: data.id,
      emoji: data.emoji || "",
      vila: data.vila || "",
      req: data.req || "",
      expansion: !!data.expansion,
      description: data.description || "",
    },
  };
  await Item.create(itemData);
}

async function createDivisionItem(data, folder) {
  const itemData = {
    name: data.name,
    type: "division",
    folder: folder?.id || folder,
    sort: data.sort ?? 0,
    system: {
      sourceId: data.id,
      description: data.description || "",
    },
  };
  const item = await Item.create(itemData);
}

/**
 * Create a Fighting Style item from library data
 * @param {object} data - Fighting style data from library
 * @param {Folder} folder - Folder to place item in
 */
async function createFightingStyleItem(data, folder) {
  const itemData = {
    name: data.name,
    type: "fightingStyle",
    folder: folder,
    sort: data.sort ?? 0,
    system: {
      sourceId: data.id,
      initialChi: data.initialChi ?? 3,
      initialWillpower: data.initialWillpower ?? 4,
      motto: data.motto || "",
      description: data.description || "",
    },
  };
  const item = await Item.create(itemData);
  await createActiveEffectsFromData(item, data.effects);
  await createRawActiveEffects(item, data);
}

/**
 * Create a Special Maneuver item from library data
 * Links category, prerequisites, costs, and overrides to world items
 * @param {object} data - Special maneuver data from library
 * @param {Folder} folder - Folder to place item in
 */
async function createSpecialManeuverItem(data, folder) {
  // Keep sourceId as link values for portability between worlds
  const category = data.category || "punch";
  
  // Convert prerequisites from library format to Foundry format
  const rawPrereqs = data.prerequisites || [];
  const prerequisites = rawPrereqs.map((prereq) => {
    if (prereq.type === "maneuver" || prereq.requiredManeuverId) {
      // Maneuver prerequisite
      return {
        type: "maneuver",
        id: prereq.requiredManeuverId || prereq.id,
        value: null,
      };
    } else {
      // Trait prerequisite (techniqueRating, attributeRating, abilityRating, backgroundRating)
      return {
        type: "trait",
        id: prereq.traitId || prereq.id,
        value: prereq.minimumValue || prereq.value || 1,
      };
    }
  });
  
  const stylePowerPointCosts = data.stylePowerPointCosts || {};
  const backgroundPowerPointCosts = data.backgroundPowerPointCosts || {};
  const damageTraitOverride = data.damageTraitOverride || null;
  const damageAttributeOverride = data.damageAttributeOverride || null;
  const speedTraitOverride = data.speedTraitOverride || null;
  const movementTraitOverride = data.movementTraitOverride || null;

  const itemData = {
    name: data.name,
    type: "specialManeuver",
    folder: folder,
    system: {
      sourceId: data.id,
      category,
      prerequisites,
      defaultPowerPointCost: data.defaultPowerPointCost ?? 0,
      stylePowerPointCosts,
      backgroundPowerPointCosts,
      chiCost: data.chiCost,
      willpowerCost: data.willpowerCost,
      speedModifier: data.speedModifier || "+0",
      damageModifier: data.damageModifier || "+0",
      movementModifier: data.movementModifier || "+0",
      notes: data.notes || "",
      ruleSummary: data.ruleSummary || "",
      damageTraitOverride,
      damageAttributeOverride,
      speedTraitOverride,
      movementTraitOverride,
      description: data.description || "",
    },
  };
  const item = await Item.create(itemData);
  await createActiveEffectsFromData(item, data.effects);
  await createRawActiveEffects(item, data);
}

/**
 * Create a Trait item from library data
 * Determines the correct item type based on category
 * @param {object} data - Trait data from library
 * @param {object} folders - Object with folders for each item type
 * @returns {Promise<string>} - The item type created
 */
async function createTraitItem(data, folders) {
  const category = data.category || "physical";
  
  // Determine item type based on category
  let itemType = "attribute";
  if (["physical", "social", "mental"].includes(category)) {
    itemType = "attribute";
  } else if (["talents", "skills", "knowledge"].includes(category)) {
    itemType = "ability";
  } else if (category === "techniques") {
    itemType = "technique";
  } else if (category === "backgrounds") {
    itemType = "background";
  }

  // Get the correct folder for this item type
  const folder = folders[itemType + "s"];

  // Build item data based on type
  const baseData = {
    name: data.name,
    type: itemType,
    folder: folder,
    sort: data.sort ?? 0,
    system: {
      sourceId: data.id,
      isOptional: data.isOptional ?? false,
      description: data.description || "",
    },
  };

  // Add type-specific fields
  switch (itemType) {
    case "attribute":
      baseData.system.category = category;
      break;
    case "ability":
      baseData.system.category = category;
      break;
    case "technique":
      baseData.system.isWeaponTechnique = data.isWeaponTechnique ?? false;
      baseData.system.isFirearmTechnique = data.isFirearmTechnique ?? false;
      break;
    case "background":
      baseData.system.isUnique = data.unique ?? false;
      baseData.system.notes = data.notes ?? "";
      break;
  }

  const item = await Item.create(baseData);
  await createActiveEffectsFromData(item, data.effects);
  await createRawActiveEffects(item, data);

  return itemType;
}

/**
 * Create a Weapon item from library data
 * @param {object} data - Weapon data from library
 * @param {Folder} folder - Folder to place item in
 */
async function createWeaponItem(data, folder) {
  // Keep sourceId as link value for portability
  const techniqueId = data.techniqueId || "";

  const itemData = {
    name: data.name,
    type: "weapon",
    folder: folder,
    sort: data.sort ?? 0,
    system: {
      sourceId: data.id,
      techniqueId,
      speed: data.speed || "",
      damage: data.damage || "",
      movement: data.movement || "",
      special: data.special || "",
      description: data.description || "",
    },
  };
  await Item.create(itemData);
}

/**
 * Show the library import dialog
 */
export async function showImportDialog() {
  const { DialogV2 } = foundry.applications.api;
  
  const content = `
    <form>
      <div class="form-group">
        <label>Library File (.fslibrary)</label>
        <input type="file" name="libraryFile" accept=".fslibrary,.json" />
      </div>
      <p style="font-size: 11px; color: #888; margin-top: 8px;">
        Items will be organized in folders by library name and item type.
      </p>
    </form>
  `;

  let fileInput = null;

  await DialogV2.prompt({
    window: {
      title: game.i18n.localize("NARUTO_RPG.Library.import"),
      icon: "fas fa-file-import",
    },
    content,
    render: (event, dialog) => {
      fileInput = dialog.element.querySelector('input[name="libraryFile"]');
    },
    ok: {
      label: game.i18n.localize("NARUTO_RPG.Library.import"),
      icon: "fas fa-file-import",
      callback: async () => {
        if (!fileInput?.files.length) {
          ui.notifications.error(game.i18n.localize("NARUTO_RPG.Errors.noFileSelected"));
          return;
        }

        const file = fileInput.files[0];
        ui.notifications.info(`Importing library: ${file.name}...`);

        const result = await importLibrary(file);

        if (result.success) {
          ui.notifications.info(
            `${game.i18n.localize("NARUTO_RPG.Library.importSuccess")} "${result.libraryName}": ` +
            `${result.counts.fightingStyles} styles, ` +
            `${result.counts.specialManeuvers} maneuvers, ` +
            `${result.counts.attributes} attributes, ` +
            `${result.counts.abilities} abilities, ` +
            `${result.counts.techniques} techniques, ` +
            `${result.counts.backgrounds} backgrounds, ` +
            `${result.counts.weapons} weapons, ` +
            `${result.counts.divisions} divisions`
          );
        }

        if (result.errors.length > 0) {
          console.warn("Library import errors:", result.errors);
          ui.notifications.warn(
            `${game.i18n.localize("NARUTO_RPG.Library.importError")}: ${result.errors.length} errors. Check console for details.`
          );
        }
      },
    },
    rejectClose: false,
  });
}
