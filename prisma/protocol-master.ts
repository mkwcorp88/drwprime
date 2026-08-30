export type ProtocolStepSeed = {
  stepCode: string;
  sequence: number;
  name: string;
  defaultRole: string;
  isRequired: boolean;
};

export type ProtocolSeed = {
  code: string;
  name: string;
  steps: ProtocolStepSeed[];
};

export const TERAPIS_OR_PERAWAT = 'TERAPIS_OR_PERAWAT';
export const PERAWAT = 'PERAWAT';
export const DOKTER = 'DOKTER';

export const TREATMENT_PROTOCOLS: ProtocolSeed[] = [
  {
    code: 'PRT-FAC-BASIC',
    name: 'Facial Basic',
    steps: [
      { stepCode: 'FACB-01', sequence: 1, name: 'Double Cleansing (Milk Cleanser & Facial Wash)', defaultRole: TERAPIS_OR_PERAWAT, isRequired: true },
      { stepCode: 'FACB-02', sequence: 2, name: 'Toner', defaultRole: TERAPIS_OR_PERAWAT, isRequired: true },
      { stepCode: 'FACB-03', sequence: 3, name: 'Massage (Wajah, Dada, dan Kepala)', defaultRole: TERAPIS_OR_PERAWAT, isRequired: true },
      { stepCode: 'FACB-04', sequence: 4, name: 'Enzim', defaultRole: TERAPIS_OR_PERAWAT, isRequired: true },
      { stepCode: 'FACB-05', sequence: 5, name: 'Vapozone / Uap', defaultRole: TERAPIS_OR_PERAWAT, isRequired: true },
      { stepCode: 'FACB-06', sequence: 6, name: 'Ekstraksi Komedo', defaultRole: TERAPIS_OR_PERAWAT, isRequired: true },
      { stepCode: 'FACB-07', sequence: 7, name: 'High Frequency', defaultRole: TERAPIS_OR_PERAWAT, isRequired: true },
      { stepCode: 'FACB-08', sequence: 8, name: 'Cooling', defaultRole: TERAPIS_OR_PERAWAT, isRequired: true },
      { stepCode: 'FACB-09', sequence: 9, name: 'Masker', defaultRole: TERAPIS_OR_PERAWAT, isRequired: true },
      { stepCode: 'FACB-10', sequence: 10, name: 'Lepas Masker dan Pengaplikasian Sunscreen', defaultRole: TERAPIS_OR_PERAWAT, isRequired: true },
    ],
  },
  {
    code: 'PRT-FAC-PRIME',
    name: 'Facial Prime',
    steps: [
      { stepCode: 'FACP-01', sequence: 1, name: 'Double Cleansing (Milk Cleanser & Facial Wash)', defaultRole: TERAPIS_OR_PERAWAT, isRequired: true },
      { stepCode: 'FACP-02', sequence: 2, name: 'Toner', defaultRole: TERAPIS_OR_PERAWAT, isRequired: true },
      { stepCode: 'FACP-03', sequence: 3, name: 'Massage (Wajah, Dada, dan Kepala)', defaultRole: TERAPIS_OR_PERAWAT, isRequired: true },
      { stepCode: 'FACP-04', sequence: 4, name: 'Enzim', defaultRole: TERAPIS_OR_PERAWAT, isRequired: true },
      { stepCode: 'FACP-05', sequence: 5, name: 'Vapozone / Uap', defaultRole: TERAPIS_OR_PERAWAT, isRequired: true },
      { stepCode: 'FACP-06', sequence: 6, name: 'Ekstraksi Komedo', defaultRole: TERAPIS_OR_PERAWAT, isRequired: true },
      { stepCode: 'FACP-07', sequence: 7, name: 'High Frequency', defaultRole: TERAPIS_OR_PERAWAT, isRequired: true },
      { stepCode: 'FACP-08', sequence: 8, name: 'Aplikasi Serum dengan Alat 9 in 1', defaultRole: TERAPIS_OR_PERAWAT, isRequired: true },
      { stepCode: 'FACP-09', sequence: 9, name: 'Masker', defaultRole: TERAPIS_OR_PERAWAT, isRequired: true },
      { stepCode: 'FACP-10', sequence: 10, name: 'Lepas Masker dan Pengaplikasian Sunscreen', defaultRole: TERAPIS_OR_PERAWAT, isRequired: true },
    ],
  },
  {
    code: 'PRT-CHEM-PEEL',
    name: 'Chemical Peeling',
    steps: [
      { stepCode: 'CHPL-01', sequence: 1, name: 'Double Cleansing (Milk Cleanser & Facial Wash)', defaultRole: TERAPIS_OR_PERAWAT, isRequired: true },
      { stepCode: 'CHPL-02', sequence: 2, name: 'Pengolesan Serum', defaultRole: TERAPIS_OR_PERAWAT, isRequired: true },
      { stepCode: 'CHPL-03', sequence: 3, name: 'Pengolesan Anti-Iritasi dan Sunscreen', defaultRole: TERAPIS_OR_PERAWAT, isRequired: true },
    ],
  },
  {
    code: 'PRT-IPL',
    name: 'IPL',
    steps: [
      { stepCode: 'IPL-01', sequence: 1, name: 'Double Cleansing (Milk Cleanser & Facial Wash)', defaultRole: TERAPIS_OR_PERAWAT, isRequired: true },
      { stepCode: 'IPL-02', sequence: 2, name: 'Pengolesan Gel', defaultRole: TERAPIS_OR_PERAWAT, isRequired: true },
      { stepCode: 'IPL-03', sequence: 3, name: 'Tindakan IPL dengan Dokter', defaultRole: DOKTER, isRequired: true },
      { stepCode: 'IPL-04', sequence: 4, name: 'Membersihkan Gel dan Pengolesan Sunscreen', defaultRole: TERAPIS_OR_PERAWAT, isRequired: true },
    ],
  },
  {
    code: 'PRT-PICO-LASER',
    name: 'Pico Laser',
    steps: [
      { stepCode: 'PICO-01', sequence: 1, name: 'Double Cleansing (Milk Cleanser & Facial Wash)', defaultRole: TERAPIS_OR_PERAWAT, isRequired: true },
      { stepCode: 'PICO-02', sequence: 2, name: 'Pengolesan Gel', defaultRole: TERAPIS_OR_PERAWAT, isRequired: true },
      { stepCode: 'PICO-03', sequence: 3, name: 'Tindakan Pico Laser dengan Dokter', defaultRole: DOKTER, isRequired: true },
      { stepCode: 'PICO-04', sequence: 4, name: 'Membersihkan Gel dan Pengolesan Sunscreen', defaultRole: TERAPIS_OR_PERAWAT, isRequired: true },
    ],
  },
  {
    code: 'PRT-DERMA-PRP',
    name: 'Dermapen PRP',
    steps: [
      { stepCode: 'DPRP-01', sequence: 1, name: 'Double Cleansing (Milk Cleanser & Facial Wash)', defaultRole: TERAPIS_OR_PERAWAT, isRequired: true },
      { stepCode: 'DPRP-02', sequence: 2, name: 'Pengolesan Anestesi', defaultRole: PERAWAT, isRequired: true },
      { stepCode: 'DPRP-03', sequence: 3, name: 'Pengambilan Darah', defaultRole: PERAWAT, isRequired: true },
      { stepCode: 'DPRP-04', sequence: 4, name: 'Centrifuge (Pemrosesan Darah)', defaultRole: PERAWAT, isRequired: true },
      { stepCode: 'DPRP-05', sequence: 5, name: 'Tindakan Dermapen EPN dengan Dokter', defaultRole: DOKTER, isRequired: true },
      { stepCode: 'DPRP-06', sequence: 6, name: 'Pengolesan Anti-Iritasi dan Sunscreen', defaultRole: TERAPIS_OR_PERAWAT, isRequired: true },
    ],
  },
  {
    code: 'PRT-DERMA-DNA-MELASMA',
    name: 'Dermapen DNA Salmon dan Melasma',
    steps: [
      { stepCode: 'DDM-01', sequence: 1, name: 'Double Cleansing (Milk Cleanser & Facial Wash)', defaultRole: TERAPIS_OR_PERAWAT, isRequired: true },
      { stepCode: 'DDM-02', sequence: 2, name: 'Pengolesan Anestesi', defaultRole: PERAWAT, isRequired: true },
      { stepCode: 'DDM-03', sequence: 3, name: 'Tindakan Dermapen EPN dengan Dokter', defaultRole: DOKTER, isRequired: true },
      { stepCode: 'DDM-04', sequence: 4, name: 'Pengolesan Anti-Iritasi dan Sunscreen', defaultRole: TERAPIS_OR_PERAWAT, isRequired: true },
    ],
  },
];
