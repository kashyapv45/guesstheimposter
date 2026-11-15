import animals from "@/data/categories/animals.json";
import brandsTech from "@/data/categories/brands-tech.json";
import countriesLandmarks from "@/data/categories/countries-landmarks.json";
import everydayObjects from "@/data/categories/everyday-objects.json";
import fictionalCharacters from "@/data/categories/fictional-characters.json";
import foodsDrinks from "@/data/categories/foods-drinks.json";
import historicalFigures from "@/data/categories/historical-figures.json";
import hobbiesActivities from "@/data/categories/hobbies-activities.json";
import jobsProfessions from "@/data/categories/jobs-professions.json";
import moviesTv from "@/data/categories/movies-tv.json";
import musicInstruments from "@/data/categories/music-instruments.json";
import natureSpace from "@/data/categories/nature-space.json";
import placesBuildings from "@/data/categories/places-buildings.json";
import sportsGames from "@/data/categories/sports-games.json";
import vehiclesTransport from "@/data/categories/vehicles-transport.json";

export type Difficulty = "easy" | "medium" | "spicy";
export type WordEntry = {
  id: string;
  word: string;
  category: string;
  categoryName: string;
  subCategory: string;
  difficulty: Difficulty;
};
export type CustomList = { id: string; name: string; words: string[] };

type CategoryFile = {
  id: string;
  name: string;
  words: Record<string, Partial<Record<Difficulty, string[]>>>;
  notes?: Record<string, string>; // hand-written crew descriptions
};

const FILES: CategoryFile[] = [
  everydayObjects, foodsDrinks, animals, countriesLandmarks, jobsProfessions, moviesTv, musicInstruments,
  sportsGames, brandsTech, natureSpace, historicalFigures, fictionalCharacters, vehiclesTransport,
  hobbiesActivities, placesBuildings,
];
const DIFFICULTIES: Difficulty[] = ["easy", "medium", "spicy"];

export const CATEGORIES = FILES.map((f) => ({ id: f.id, name: f.name }));

export const WORDS: WordEntry[] = FILES.flatMap((f) =>
  Object.entries(f.words).flatMap(([subCategory, byDiff]) =>
    DIFFICULTIES.flatMap((difficulty) =>
      (byDiff[difficulty] ?? []).map((word) => ({
        id: `${f.id}:${word}`, word, category: f.id, categoryName: f.name, subCategory, difficulty,
      })),
    ),
  ),
);

const NOTES = new Map(FILES.flatMap((f) => Object.entries(f.notes ?? {}).map(([w, d]) => [`${f.id}:${w}`, d])));
export const noteFor = (w: WordEntry) => NOTES.get(w.id) ?? null;


export function customEntries(lists: CustomList[]): WordEntry[] {
  return lists.flatMap((l) =>
    l.words.map((word) => ({
      id: `${l.id}:${word}`, word, category: l.id, categoryName: l.name, subCategory: "Custom", difficulty: "medium" as const,
    })),
  );
}

