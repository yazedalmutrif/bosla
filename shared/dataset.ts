// Types for data/dataset.json (curated from Yazeed's job-map research; see meta.sources).
export interface Bilingual {
  ar: string;
  en: string;
}

export interface LinkCheck {
  checkedOn: string;
  ok: boolean | null;
  status: number | null;
  note?: string;
}

export interface Range {
  min: number;
  max: number;
}

export interface DatasetCompany {
  id: string;
  name: Bilingual;
  cities: string[];
  sector: string;
  fields: string[];
  typicalRoles: string[];
  about: Bilingual;
  goodFor: Bilingual;
  salary: (Range & { kind: "estimate"; level?: string }) | null;
  salaryByField?: Record<string, Range & { sourceId?: string; asOf?: string }>;
  careersUrl: string;
  linkType: string;
  sourceId: string;
  asOf: string;
  linkCheck?: LinkCheck;
  replacedLink?: string;
}

export interface DatasetSalaryRow {
  id: string;
  field: string;
  segment: Bilingual;
  start: Range;
  later: (Range & { afterYears: number }) | null;
  note: Bilingual | null;
  kind: "estimate" | "official";
  sourceId: string;
  asOf: string;
}

export interface DatasetProgram {
  id: string;
  name: Bilingual;
  provider: string;
  fields: string[];
  requirements: Bilingual;
  deadline: string | null;
  stipendOrSalary?: (Range & { kind: string }) | null;
  url: string;
  sourceId: string;
  asOf: string;
  verified?: boolean;
  linkCheck?: LinkCheck;
}

export interface DatasetPlatform {
  id: string;
  name: Bilingual;
  url: string;
  fields: string[];
  goodFor: Bilingual;
  sourceId: string;
  asOf: string;
  linkCheck?: LinkCheck;
}

export interface DatasetPattern {
  id: string;
  title: Bilingual;
  detail: Bilingual;
  sourceId: string;
}

export interface DatasetSource {
  id: string;
  title: string;
  kind?: "author-research" | "official-page";
  url?: string;
  date: string;
}

export interface Dataset {
  meta: {
    title: string;
    compiledOn: string;
    currency: string;
    salaryPeriod: string;
    salaryDisclaimer: Bilingual;
    sources: DatasetSource[];
  };
  fields: Array<{ id: string } & Bilingual>;
  sectors: Array<{ id: string } & Bilingual>;
  cities: Array<{ id: string } & Bilingual>;
  companies: DatasetCompany[];
  salaryTable: DatasetSalaryRow[];
  programs: DatasetProgram[];
  platforms: DatasetPlatform[];
  cvPatterns: DatasetPattern[];
}
