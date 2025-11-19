import path from 'path';
import { readJsonFile, writeJsonFile } from './json-store';

export type BannerSettings = {
  title: string;
  imageUrl: string;
  animated: boolean;
  notes: string;
  updatedAt: string;
};

const DATA_PATH = path.join(process.cwd(), 'data', 'banner.json');

const defaultBanner: BannerSettings = {
  title: 'Banner reclama',
  imageUrl: '',
  animated: false,
  notes:
    'Accepta JPG/PNG/GIF. Bannerul de pe desktop este afisat sub stirea principala, cu link catre de-vanzare.ro. Daca bifezi optiunea, se va afisa bannerul animat in locul imaginii.',
  updatedAt: new Date().toISOString(),
};

export const getBannerSettings = async (): Promise<BannerSettings> => {
  const data = await readJsonFile<BannerSettings>(DATA_PATH, defaultBanner);
  return {
    ...defaultBanner,
    ...data,
  };
};

export const updateBannerSettings = async (settings: Partial<BannerSettings>) => {
  const current = await getBannerSettings();
  const updated: BannerSettings = {
    ...current,
    ...settings,
    updatedAt: new Date().toISOString(),
  };
  await writeJsonFile(DATA_PATH, updated);
  return updated;
};
