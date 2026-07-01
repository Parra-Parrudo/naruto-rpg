/**
 * Naruto RPG System Settings
 * @author Kirlian Silvestre
 */

export function registerSettings() {
  game.settings.register("naruto-rpg", "systemMigrationVersion", {
    name: "System Migration Version",
    scope: "world",
    config: false,
    type: String,
    default: "",
  });


  game.settings.register("naruto-rpg", "onesRemoveSuccesses", {
    name: "NARUTO_RPG.Settings.OnesRemoveSuccesses.Name",
    hint: "NARUTO_RPG.Settings.OnesRemoveSuccesses.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register("naruto-rpg", "criticalFailureRule", {
    name: "NARUTO_RPG.Settings.CriticalFailureRule.Name",
    hint: "NARUTO_RPG.Settings.CriticalFailureRule.Hint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      "moreOnesThanSuccesses": "NARUTO_RPG.Settings.CriticalFailureRule.MoreOnesThanSuccesses",
      "onesWithNoSuccesses": "NARUTO_RPG.Settings.CriticalFailureRule.OnesWithNoSuccesses",
      "disabled": "NARUTO_RPG.Settings.CriticalFailureRule.Disabled",
    },
    default: "moreOnesThanSuccesses",
  });

  game.settings.register("naruto-rpg", "hidePlayerManeuversFromGM", {
    name: "NARUTO_RPG.Settings.HidePlayerManeuversFromGM.Name",
    hint: "NARUTO_RPG.Settings.HidePlayerManeuversFromGM.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register("naruto-rpg", "autoAddTraitsOnImport", {
    name: "NARUTO_RPG.Settings.AutoAddTraitsOnImport.Name",
    hint: "NARUTO_RPG.Settings.AutoAddTraitsOnImport.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register("naruto-rpg", "autoAddTraitsOnManualCreate", {
    name: "NARUTO_RPG.Settings.AutoAddTraitsOnManualCreate.Name",
    hint: "NARUTO_RPG.Settings.AutoAddTraitsOnManualCreate.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });
}
