export interface SurveyChoiceOption {
  value: number | boolean;
  label: string;
}

export const SURVEY_CHOICE_OPTIONS = {
  propertyType: [
    { value: 123160000, label: "Detached" },
    { value: 123160001, label: "Semi-Detached" },
    { value: 123160002, label: "Terraced" },
    { value: 123160003, label: "Bungalow" },
    { value: 123160004, label: "Flat / Apartment" },
    { value: 123160005, label: "Other" }
  ],
  propertyAge: [
    { value: 123160000, label: "Pre-1900" },
    { value: 123160001, label: "1900-1939" },
    { value: 123160002, label: "1940-1969" },
    { value: 123160003, label: "1970-1999" },
    { value: 123160004, label: "2000+" },
    { value: 123160005, label: "Unknown" }
  ],
  existingHatchType: [
    { value: 123160000, label: "Existing Hatch" },
    { value: 123160001, label: "New Hatch Required" },
    { value: 123160002, label: "Other" },
    { value: 123160003, label: "Unknown" },
    { value: 123160004, label: "Pushup" },
    { value: 123160005, label: "Dropdown" },
    { value: 123160006, label: "No Hatch" }
  ],
  flooringRequired: [
    { value: false, label: "No" },
    { value: true, label: "Yes" }
  ],
  ladderRequired: [
    { value: false, label: "No" },
    { value: true, label: "Yes" }
  ],
  lightRequired: [
    { value: 123160000, label: "Yes" },
    { value: 123160001, label: "No" },
    { value: 123160002, label: "Already Installed" }
  ],
  insulationRequired: [
    { value: false, label: "No" },
    { value: true, label: "Yes" }
  ],
  advertisingSource: [
    { value: 1, label: "Advertisement" },
    { value: 2, label: "Employee Referral" },
    { value: 3, label: "External Referral" },
    { value: 4, label: "Partner" },
    { value: 5, label: "Public Relations" },
    { value: 6, label: "Seminar" },
    { value: 7, label: "Trade Show" },
    { value: 8, label: "Web" },
    { value: 9, label: "Word of Mouth" },
    { value: 10, label: "Other" }
  ]
} as const satisfies Record<string, readonly SurveyChoiceOption[]>;

export type SurveyChoiceField = keyof typeof SURVEY_CHOICE_OPTIONS;

export function surveyChoiceOption(field: SurveyChoiceField, label: string | undefined): SurveyChoiceOption | undefined {
  if (!label) return undefined;
  const normalized = label.trim().toLocaleLowerCase("en-GB");
  return SURVEY_CHOICE_OPTIONS[field].find(option => option.label.toLocaleLowerCase("en-GB") === normalized);
}

export function assertValidSurveyChoices(details: Partial<Record<SurveyChoiceField, string>> | undefined): void {
  if (!details) return;
  for (const field of Object.keys(SURVEY_CHOICE_OPTIONS) as SurveyChoiceField[]) {
    const label = details[field];
    if (label && !surveyChoiceOption(field, label)) {
      throw new Error(`Invalid survey choice for ${field}.`);
    }
  }
}
