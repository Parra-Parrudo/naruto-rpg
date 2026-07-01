/**
 * Naruto RPG Combat Socket Handler
 * Manages real-time communication for combat events
 * @author Kirlian Silvestre
 */

import { SOCKET_EVENTS, FLAG_SCOPE } from "./combat-phases.mjs";

/**
 * Socket namespace for the Naruto RPG system
 * @constant {string}
 */
const SOCKET_NAMESPACE = "system.naruto-rpg";

/**
 * Registers socket listeners for combat events
 */
export function registerCombatSockets() {
  console.log("Naruto RPG | Registering combat sockets on namespace:", SOCKET_NAMESPACE);
  game.socket.on(SOCKET_NAMESPACE, handleSocketMessage);
}

/**
 * Handles incoming socket messages
 * @param {object} data - Socket message data
 * @param {string} data.type - Event type
 * @param {object} data.payload - Event payload
 */
function handleSocketMessage(data) {
  console.log("Naruto RPG | Socket message received:", data);
  const { type, payload } = data;

  switch (type) {
    case SOCKET_EVENTS.INTERRUPTION:
      handleInterruptionEvent(payload);
      break;
    case SOCKET_EVENTS.MANEUVER_REVEALED:
      handleManeuverRevealedEvent(payload);
      break;
    case SOCKET_EVENTS.TURN_STARTED:
      handleTurnStartedEvent(payload);
      break;
    case SOCKET_EVENTS.PHASE_CHANGED:
      handlePhaseChangedEvent(payload);
      break;
    case SOCKET_EVENTS.REQUEST_INTERRUPTION:
      handleRequestInterruption(payload);
      break;
    case SOCKET_EVENTS.REQUEST_COMPLETE_ACTION:
      handleRequestCompleteAction(payload);
      break;
    case SOCKET_EVENTS.REQUEST_SKIP_ACTION:
      handleRequestSkipAction(payload);
      break;
    default:
      console.warn(`Naruto RPG | Unknown socket event type: ${type}`);
  }
}

/**
 * Emits a socket event to all clients
 * @param {string} type - Event type from SOCKET_EVENTS
 * @param {object} payload - Event data
 */
export function emitCombatEvent(type, payload) {
  game.socket.emit(SOCKET_NAMESPACE, { type, payload });
  handleSocketMessage({ type, payload });
}

/**
 * Handles interruption notification
 * @param {object} payload - Interruption data
 * @param {string} payload.interruptorName - Name of the interrupting combatant
 * @param {string} payload.interruptedName - Name of the interrupted combatant
 * @param {string} payload.combatId - Combat document ID
 */
function handleInterruptionEvent(payload) {
  const { interruptorName, interruptedName, combatId } = payload;

  const message = game.i18n.format("NARUTO_RPG.Combat.InterruptionNotification", {
    interruptor: interruptorName,
    interrupted: interruptedName
  });

  showCombatNotification(message, "interruption");

  ui.combat?.render();
}

/**
 * Handles maneuver revealed notification
 * @param {object} payload - Reveal data
 * @param {string} payload.combatantName - Name of the combatant
 * @param {string} payload.maneuverName - Name of the revealed maneuver
 * @param {string} payload.combatId - Combat document ID
 */
function handleManeuverRevealedEvent(payload) {
  const { combatantName, maneuverName, combatId } = payload;

  ui.combat?.render();
}

/**
 * Handles turn started notification
 * @param {object} payload - Turn data
 * @param {string} payload.combatantName - Name of the combatant whose turn started
 * @param {string} payload.combatId - Combat document ID
 */
function handleTurnStartedEvent(payload) {
  const { combatantName, combatantId, combatId } = payload;

  const combat = game.combats.get(combatId);
  if (!combat) return;

  const combatant = combat.combatants.get(combatantId);
  if (!combatant) return;

  // Show dialog to owner (player) or to GM for NPCs
  const isNPC = combatant.isNPC;
  const shouldShowToPlayer = combatant.isOwner && !game.user.isGM;
  const shouldShowToGMForNPC = game.user.isGM && isNPC;

  if (shouldShowToPlayer || shouldShowToGMForNPC) {
    showActionTurnPanel(combat, combatant);
  }

  ui.combat?.render();
}

/**
 * Handles phase changed notification
 * @param {object} payload - Phase data
 * @param {string} payload.phase - New combat phase
 * @param {string} payload.combatId - Combat document ID
 */
function handlePhaseChangedEvent(payload) {
  const { phase, combatId } = payload;

  ui.combat?.render();
}

/**
 * Shows a large combat notification to all players
 * @param {string} message - Notification message
 * @param {string} type - Notification type (interruption, info, etc.)
 */
function showCombatNotification(message, type = "info") {
  const notificationHtml = `
    <div class="nrpg-combat-notification nrpg-combat-notification--${type}">
      <div class="nrpg-combat-notification__content">
        <i class="fas fa-bolt"></i>
        <span>${message}</span>
      </div>
    </div>
  `;

  const notification = document.createElement("div");
  notification.innerHTML = notificationHtml;
  const element = notification.firstElementChild;

  document.body.appendChild(element);

  setTimeout(() => {
    element.classList.add("nrpg-combat-notification--fade-out");
    setTimeout(() => element.remove(), 500);
  }, 3000);
}

/**
 * Shows the action turn panel for the current player
 * @param {Combat} combat - The combat document
 * @param {Combatant} combatant - The combatant whose turn it is
 */
async function showActionTurnPanel(combat, combatant) {
  const { ActionTurnDialog } = await import("./action-turn-dialog.mjs");
  ActionTurnDialog.show(combat, combatant);
}

/**
 * Handles a player request to interrupt (GM executes)
 * @param {object} payload - Request data
 * @param {string} payload.combatId - Combat ID
 * @param {string} payload.interruptorId - Interrupting combatant ID
 */
async function handleRequestInterruption(payload) {
  console.log("Naruto RPG | Received interrupt request", payload, "isGM:", game.user.isGM);
  if (!game.user.isGM) return;

  const { combatId, interruptorId } = payload;
  const combat = game.combats.get(combatId);
  if (!combat) {
    console.warn("Naruto RPG | Combat not found:", combatId);
    return;
  }

  console.log("Naruto RPG | GM executing interruption for", interruptorId);
  await combat.handleInterruption(interruptorId);
}

/**
 * Handles a player request to complete their action (GM executes)
 * @param {object} payload - Request data
 * @param {string} payload.combatId - Combat ID
 */
async function handleRequestCompleteAction(payload) {
  if (!game.user.isGM) return;

  const { combatId } = payload;
  const combat = game.combats.get(combatId);
  if (!combat) return;

  await combat.completeCurrentAction();
}

/**
 * Handles a player request to skip their action (GM executes)
 * @param {object} payload - Request data
 * @param {string} payload.combatId - Combat ID
 */
async function handleRequestSkipAction(payload) {
  if (!game.user.isGM) return;

  const { combatId } = payload;
  const combat = game.combats.get(combatId);
  if (!combat) return;

  await combat.skipCurrentAction();
}

/**
 * Request an interruption (for players to call)
 * @param {Combat} combat - The combat document
 * @param {string} interruptorId - The interrupting combatant ID
 */
export async function requestInterruption(combat, interruptorId) {
  if (game.user.isGM) {
    await combat.handleInterruption(interruptorId);
  } else {
    console.log("Naruto RPG | Player sending interrupt request for", interruptorId);
    // Send to GM via socket
    const gmUsers = game.users.filter(u => u.isGM && u.active);
    if (gmUsers.length === 0) {
      ui.notifications.warn("No active GM to process the request.");
      return;
    }
    game.socket.emit(SOCKET_NAMESPACE, {
      type: SOCKET_EVENTS.REQUEST_INTERRUPTION,
      payload: { combatId: combat.id, interruptorId }
    });
    ui.notifications.info("Interrupt request sent to GM.");
  }
}

/**
 * Request to complete the current action (for players to call)
 * @param {Combat} combat - The combat document
 */
export function requestCompleteAction(combat) {
  if (game.user.isGM) {
    combat.completeCurrentAction();
  } else {
    console.log("Naruto RPG | Player sending complete action request");
    game.socket.emit(SOCKET_NAMESPACE, {
      type: SOCKET_EVENTS.REQUEST_COMPLETE_ACTION,
      payload: { combatId: combat.id }
    });
  }
}

/**
 * Request to skip the current action (for players to call)
 * @param {Combat} combat - The combat document
 */
export function requestSkipAction(combat) {
  if (game.user.isGM) {
    combat.skipCurrentAction();
  } else {
    console.log("Naruto RPG | Player sending skip action request");
    game.socket.emit(SOCKET_NAMESPACE, {
      type: SOCKET_EVENTS.REQUEST_SKIP_ACTION,
      payload: { combatId: combat.id }
    });
  }
}

/**
 * Broadcasts an interruption event
 * @param {Combat} combat - The combat document
 * @param {Combatant} interruptor - The interrupting combatant
 * @param {Combatant} interrupted - The interrupted combatant
 */
export function broadcastInterruption(combat, interruptor, interrupted) {
  emitCombatEvent(SOCKET_EVENTS.INTERRUPTION, {
    interruptorName: interruptor.name,
    interruptedName: interrupted.name,
    combatId: combat.id
  });
}

/**
 * Broadcasts a maneuver revealed event
 * @param {Combat} combat - The combat document
 * @param {Combatant} combatant - The combatant revealing their maneuver
 * @param {string} maneuverName - Name of the revealed maneuver
 */
export function broadcastManeuverRevealed(combat, combatant, maneuverName) {
  emitCombatEvent(SOCKET_EVENTS.MANEUVER_REVEALED, {
    combatantName: combatant.name,
    maneuverName,
    combatId: combat.id
  });
}

/**
 * Broadcasts a turn started event
 * @param {Combat} combat - The combat document
 * @param {Combatant} combatant - The combatant whose turn is starting
 */
export function broadcastTurnStarted(combat, combatant) {
  emitCombatEvent(SOCKET_EVENTS.TURN_STARTED, {
    combatantName: combatant.name,
    combatantId: combatant.id,
    combatId: combat.id
  });
}

/**
 * Broadcasts a phase changed event
 * @param {Combat} combat - The combat document
 * @param {string} phase - The new phase
 */
export function broadcastPhaseChanged(combat, phase) {
  emitCombatEvent(SOCKET_EVENTS.PHASE_CHANGED, {
    phase,
    combatId: combat.id
  });
}
