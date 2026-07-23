/** Shared connection-check type: only sequence statements may chain together. */
export const SEQUENCE_STATEMENT = "SequenceStatement";

/**
 * Connection-check type for sequence_participant only, kept separate from
 * SEQUENCE_STATEMENT so participants chain (and reorder by dragging) among
 * themselves without mixing into a Message/Alt/Opt/Loop body or vice versa
 * (01_requirements.md FR-SEQ-11).
 */
export const PARTICIPANT_STATEMENT = "ParticipantStatement";

/**
 * Block types that declare a lifeline usable as a Message FROM/TO or Note
 * TARGET (Participant, Actor). PlantUML treats `actor`/`participant` as the
 * same kind of identifier (only the rendered shape differs), so every place
 * that used to hardcode "sequence_participant" alone (dropdown candidates,
 * dangling-reference validation, rename sync, the duplicate-name owner set,
 * the auto-default fallback, and PlantUML import) is generalized to this set.
 */
export const PARTICIPANT_LIKE_TYPES = ["sequence_participant", "sequence_actor"] as const;
