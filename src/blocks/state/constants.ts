/**
 * Shared connection-check type for all state-diagram statements (State,
 * Transition, Composite State, Raw PlantUML Line). Unlike sequence diagrams'
 * PARTICIPANT_STATEMENT, state diagrams have no declaration-order-sensitive
 * concept (PlantUML lays states out as a graph, not by declaration order, per
 * 02_design.md 18.2), so a single connection type is enough.
 */
export const STATE_STATEMENT = "StateStatement";
