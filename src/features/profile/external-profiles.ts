export type ExternalProfile = {
  label: string;
  url: string;
  sameAs: boolean;
};

export const externalProfiles: ExternalProfile[] = [
  {
    label: "LinkedIn",
    url: "https://www.linkedin.com/in/thavarshan",
    sameAs: true
  },
  {
    label: "GitHub",
    url: "https://github.com/Thavarshan",
    sameAs: true
  },
  {
    label: "DEV Community",
    url: "https://dev.to/thavarshan",
    sameAs: true
  },
  {
    label: "Stack Overflow",
    url: "https://stackoverflow.com/users/22805289/jerome-thayananthajothy",
    sameAs: true
  },
  {
    label: "Packagist",
    url: "https://packagist.org/packages/jerome/",
    sameAs: true
  }
];

export const sameAsProfiles = externalProfiles.filter((profile) => profile.sameAs).map((profile) => profile.url);
