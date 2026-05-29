import { useState, useEffect, useCallback, useRef } from 'react';
import { MaterialOption } from '../types';
import { getFavourites, saveFavourites } from '../api';

const STORAGE_KEY = 'moodboard_favourites_v1';

// Fields that are per-session or per-board — strip before saving
function stripEphemeral(item: MaterialOption): MaterialOption {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { customImage, coloredIconBlobUrl, note, excludeFromMoodboardRender, ...rest } = item;
  return rest as MaterialOption;
}

function loadFromStorage(): MaterialOption[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MaterialOption[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage(items: MaterialOption[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore quota errors
  }
}

export interface UseFavouritesReturn {
  favourites: MaterialOption[];
  isFavourite: (id: string) => boolean;
  toggleFavourite: (item: MaterialOption) => void;
  isLoaded: boolean;
}

export function useFavourites(
  getAccessToken: () => Promise<string | null>,
  isAuthenticated: boolean,
): UseFavouritesReturn {
  const [favourites, setFavourites] = useState<MaterialOption[]>(loadFromStorage);
  const [isLoaded, setIsLoaded] = useState(false);
  const isAuthenticatedRef = useRef(isAuthenticated);
  isAuthenticatedRef.current = isAuthenticated;

  // On sign-in, fetch from API and overwrite local state
  useEffect(() => {
    if (!isAuthenticated) {
      setIsLoaded(true);
      return;
    }
    getAccessToken()
      .then(async (token) => {
        if (!token) return;
        const items = await getFavourites(token);
        setFavourites(items);
        saveToStorage(items);
      })
      .catch(() => {/* use localStorage as fallback */})
      .finally(() => setIsLoaded(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const syncToApi = useCallback(
    async (items: MaterialOption[]) => {
      try {
        const token = await getAccessToken();
        if (token) await saveFavourites(token, items);
      } catch {
        // fire-and-forget: localStorage already updated
      }
    },
    [getAccessToken],
  );

  const toggleFavourite = useCallback(
    (item: MaterialOption) => {
      setFavourites((prev) => {
        const exists = prev.some((f) => f.id === item.id);
        const next = exists
          ? prev.filter((f) => f.id !== item.id)
          : [...prev, stripEphemeral(item)];
        saveToStorage(next);
        if (isAuthenticatedRef.current) syncToApi(next);
        return next;
      });
    },
    [syncToApi],
  );

  const isFavourite = useCallback(
    (id: string) => favourites.some((f) => f.id === id),
    [favourites],
  );

  return { favourites, isFavourite, toggleFavourite, isLoaded };
}
