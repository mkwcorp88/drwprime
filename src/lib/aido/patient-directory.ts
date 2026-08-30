import { AidoClient, type AidoSession } from '@/lib/aido/client';
import { mapAidoPatient, type AidoPatient } from '@/lib/aido/mapping';

const DIRECTORY_TTL_MS = 5 * 60 * 1000;

type DirectoryCache = {
  session: AidoSession;
  expiresAt: number;
  patients: AidoPatient[];
};

let directoryCache: DirectoryCache | null = null;
let directoryLoading: Promise<{ session: AidoSession; patients: AidoPatient[] }> | null = null;

async function getDirectory(): Promise<{ session: AidoSession; patients: AidoPatient[] }> {
  const now = Date.now();

  if (directoryCache && directoryCache.expiresAt > now) {
    return { session: directoryCache.session, patients: directoryCache.patients };
  }

  if (directoryLoading) return directoryLoading;

  const load = (async () => {
    const client = AidoClient.fromEnv();
    const session = await client.login();
    const patients = (await client.getAllPatients(session))
      .map(mapAidoPatient)
      .filter((patient): patient is AidoPatient => patient !== null);
    directoryCache = {
      session,
      expiresAt: Date.now() + DIRECTORY_TTL_MS,
      patients,
    };
    return { session, patients };
  })();
  directoryLoading = load;
  try {
    return await load;
  } finally {
    if (directoryLoading === load) directoryLoading = null;
  }
}

function searchableText(patient: AidoPatient): string {
  return [
    patient.firstName,
    patient.lastName,
    patient.phone,
    patient.mrNumber,
    patient.externalPatientNumericId,
    patient.externalPatientId,
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('id-ID');
}

export async function searchAidoPatients(query: string): Promise<AidoPatient[]> {
  const normalizedQuery = query.trim().toLocaleLowerCase('id-ID');
  if (!normalizedQuery) return [];

  const { patients } = await getDirectory();
  return patients
    .filter((patient) => searchableText(patient).includes(normalizedQuery))
    .sort((left, right) => {
      const leftName = [left.firstName, left.lastName].filter(Boolean).join(' ').toLocaleLowerCase('id-ID');
      const rightName = [right.firstName, right.lastName].filter(Boolean).join(' ').toLocaleLowerCase('id-ID');
      return Number(!leftName.startsWith(normalizedQuery)) - Number(!rightName.startsWith(normalizedQuery));
    })
    .slice(0, 30);
}

export async function findAidoPatient(externalPatientId: string): Promise<{ session: AidoSession; patient: AidoPatient | null }> {
  const directory = await getDirectory();
  return {
    session: directory.session,
    patient: directory.patients.find((item) => item.externalPatientId === externalPatientId) ?? null,
  };
}
