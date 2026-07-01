/**
 * Naruto RPG Combat Module
 * Exports all combat-related components
 * @author Kirlian Silvestre
 */

export { NarutoRpgCombat } from "./combat.mjs";
export { NarutoRpgCombatant } from "./combatant.mjs";
export { NarutoRpgCombatTracker } from "./combat-tracker.mjs";
export { ManeuverSelectionDialog } from "./maneuver-selection-dialog.mjs";
export { ActionTurnDialog } from "./action-turn-dialog.mjs";
export { registerCombatSockets } from "./combat-socket.mjs";

export {
  COMBAT_PHASE,
  SELECTION_STATUS,
  ACTION_STATUS,
  SOCKET_EVENTS,
  FLAG_SCOPE,
  COMBAT_FLAGS,
  COMBATANT_FLAGS,
  getDefaultCombatFlags,
  getDefaultCombatantFlags,
  createSelectedManeuver,
  calculateSpeedTiebreaker,
  canInterrupt,
  sortByInitiative
} from "./combat-phases.mjs";
