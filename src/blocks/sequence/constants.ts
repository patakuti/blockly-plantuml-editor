/** Shared connection-check type: only sequence statements may chain together. */
export const SEQUENCE_STATEMENT = "SequenceStatement";

/**
 * Connection-check type for sequence_participant only, kept separate from
 * SEQUENCE_STATEMENT so participants chain (and reorder by dragging) among
 * themselves without mixing into a Message/Alt/Opt/Loop body or vice versa
 * (01_requirements.md FR-SEQ-11).
 */
export const PARTICIPANT_STATEMENT = "ParticipantStatement";
