/** Internal identifiers; display names and navigation labels are separate. */
export type EntityId<Kind extends string> = string & { readonly __entityKind: Kind };
export type Timestamp = string; // ISO 8601
export type Origin = 'dave' | 'researcher' | 'dave_edited_by_researcher';
export type Actor = 'dave' | 'researcher';
export type ReviewState =
  | 'proposed'
  | 'accepted'
  | 'partially_accepted'
  | 'rejected'
  | 'unresolved';

export interface Review {
  state: ReviewState;
  note?: string;
}

/** Plain-language limitations, without invented numerical confidence. */
export type Limitations = string[];

/** Retained previous content, not an audit log of every interaction. */
export interface Revision<Content> {
  revision: number;
  content: Content;
  origin: Origin;
  savedAt: Timestamp;
  changedBy: Actor;
  note?: string;
}

export interface Entity<Kind extends string, Content> {
  id: EntityId<Kind>;
  origin: Origin;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  revision: number;
  history: Revision<Content>[];
  /** Archive referenced objects instead of breaking provenance by deleting them. */
  archivedAt?: Timestamp;
}

/** Stable link plus the revision used; later edits do not erase its basis. */
export interface EntityReference<Kind extends string> {
  id: EntityId<Kind>;
  revision: number;
}

export interface ResearchReferences {
  evidence: EntityReference<'evidence'>[];
  claims: EntityReference<'claim'>[];
  relationships: EntityReference<'relationship'>[];
  dimensions: EntityReference<'dimension'>[];
}

/** Opaque reference to a stored file. No browser storage implementation implied. */
export interface AssetReference {
  id: EntityId<'asset'>;
  filename: string;
  mediaType: string;
}

export interface ProjectContent {
  name: string;
  context: string;
}

export interface Project extends Entity<'project', ProjectContent>, ProjectContent {
  modelVersion: 1;
  sources: Source[];
  categories: ResearchCategory[];
  evidence: Evidence[];
  claims: Claim[];
  relationships: Relationship[];
  dimensions: Dimension[];
  dimensionPositions: DimensionPosition[];
  explorationNodes: ExplorationNode[];
  explorationConnections: ExplorationConnection[];
  directions: Direction[];
}

export interface SourceContent {
  title: string;
  originalFile: AssetReference;
  /** Descriptive source type, such as interview or field notes. */
  sourceType?: string;
  primaryCategoryId?: EntityId<'research_category'>;
  summary?: string;
  limitations: Limitations;
  /** Descriptive extraction only; not evidence, claims, or thematic membership. */
  preparedContent?: {
    format: 'pdf' | 'txt' | 'docx';
    extractedAt: Timestamp;
    sections: { location: string; text: string }[];
    limitations: Limitations;
  };
}

export interface Source extends Entity<'source', SourceContent>, SourceContent {
  /** Operational processing changes need not create content revisions. */
  processingState: 'unprocessed' | 'processing' | 'ready' | 'failed';
  processingError?: string;
}

/** A verified range in an unchanged extracted source revision. */
export interface ResearchPassage {
  source: EntityReference<'source'>;
  sectionIndex: number;
  start: number;
  end: number;
}

export interface ResearchCategoryContent {
  name: string;
  description?: string;
  passages?: ResearchPassage[];
  review?: Review;
  analysis?: { id: string; model: string; analysedAt: Timestamp; promptVersion: string };
}

export interface ResearchCategory
  extends Entity<'research_category', ResearchCategoryContent>, ResearchCategoryContent {
  order: number;
}

export interface EvidenceContent {
  /** Exact verified source range and category context retained for provenance. */
  passage?: ResearchPassage;
  categories?: EntityReference<'research_category'>[];
  source: EntityReference<'source'>;
  text: string;
  form: 'quotation' | 'description';
  /** Human-readable locator: page, timestamp, section, or image region. */
  location: string;
  context: string;
  limitations: Limitations;
}

/** Correcting extraction creates a revision; interpretation edits never edit this. */
export interface Evidence extends Entity<'evidence', EvidenceContent>, EvidenceContent {}

export interface ClaimContent {
  statement: string;
  /** At least one source-grounded piece of evidence is required. */
  evidence: [EntityReference<'evidence'>, ...EntityReference<'evidence'>[]];
  context: string;
  stakeholder?: string;
  limitations: Limitations;
  review: Review;
}

export interface Claim extends Entity<'claim', ClaimContent>, ClaimContent {
  mapPosition?: { x: number; y: number };
}

export type RelationshipType =
  | 'connection'
  | 'potential_tension'
  | 'unclassified'
  // Older snapshots keep original types and reviews until explicitly classified.
  | 'contradiction'
  | 'perspective_conflict'
  | 'trade_off'
  | 'expectation_experience_gap'
  | 'unresolved_evidence'
  | 'sequencing'
  | 'contextual_variation'
  | 'complementary_needs'
  | 'no_meaningful_relationship';

export interface RelationshipClaim {
  claim: EntityReference<'claim'>;
  role?: string;
}

export interface RelationshipContent {
  evidence?: EntityReference<'evidence'>[];
  description: string;
  type: RelationshipType;
  claims: [RelationshipClaim, RelationshipClaim, ...RelationshipClaim[]];
  explanation: string;
  contextCheck?: string;
  challenge?: string;
  limitations: Limitations;
  review: Review;
}

export interface Relationship
  extends Entity<'relationship', RelationshipContent>, RelationshipContent {
  mapPosition?: { x: number; y: number };
}

export interface DimensionContent {
  name: string;
  lowLabel: string;
  midLabel?: string;
  highLabel: string;
  rationale?: string;
  grounding?: 'research_grounded' | 'inferred';
  draftPosition?: -1 | 0 | 1;
  explanation: string;
  claims: EntityReference<'claim'>[];
  relationships: EntityReference<'relationship'>[];
  limitations: Limitations;
  review: Review;
}

export interface Dimension extends Entity<'dimension', DimensionContent>, DimensionContent {}

export interface DimensionPositionContent {
  dimension: EntityReference<'dimension'>;
  selected: boolean;
  /** 0–1 between the endpoints; null is undecided, 0.5 is deliberately neutral. */
  value: number | null;
  reasoning?: string;
  confirmedAt?: Timestamp;
}

/** One current record per dimension; numeric bounds require later validation. */
export interface DimensionPosition
  extends Entity<'dimension_position', DimensionPositionContent>, DimensionPositionContent {}

export type ExplorationContent =
  | { type: 'note' | 'idea' | 'question'; text: string }
  | { type: 'image' | 'sketch'; asset: AssetReference; text?: string };

export interface ExplorationNodeContent {
  title?: string;
  content: ExplorationContent;
  /** Empty lists are valid for free exploration without research grounding. */
  references: ResearchReferences;
  dimensionPositions: EntityReference<'dimension_position'>[];
  limitations: Limitations;
}

export interface ExplorationNode
  extends Entity<'exploration_node', ExplorationNodeContent>, ExplorationNodeContent {
  /** Board movement is not part of meaningful content history. */
  position: { x: number; y: number };
}

export interface ExplorationConnectionContent {
  fromNodeId: EntityId<'exploration_node'>;
  toNodeId: EntityId<'exploration_node'>;
  label?: string;
  /** Direction is a visual relationship, not a claim of causality. */
  directional: boolean;
}

export interface ExplorationConnection
  extends Entity<'exploration_connection', ExplorationConnectionContent>, ExplorationConnectionContent {}

/** Values and endpoint meanings frozen when a designer creates a direction. */
export interface TuningSnapshot {
  dimension: EntityReference<'dimension'>;
  position: EntityReference<'dimension_position'>;
  dimensionName: string;
  lowLabel: string;
  highLabel: string;
  selected: boolean;
  value: number | null;
  reasoning?: string;
}

export interface DirectionContent {
  title: string;
  description: string;
  reasoning: string;
  openQuestions: string[];
  state: 'draft' | 'retained' | 'archived';
  explorationNodes: EntityReference<'exploration_node'>[];
  references: ResearchReferences;
  tuningSnapshot: TuningSnapshot[];
  limitations: Limitations;
}

/** Creation is explicitly chosen by a designer; no automatic promotion implied. */
export interface Direction extends Entity<'direction', DirectionContent>, DirectionContent {
  designatedBy: 'researcher';
}
