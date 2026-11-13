import { site } from "./site";
import type { HomesContent } from "./types";

const { hometown, home } = site.places;
const distance = site.distanceKm.toLocaleString("en-NZ");
/** How far apart the two latitudes are once one is mirrored across the equator. */
const latitudeGap = Math.abs(Math.abs(home.lat) - Math.abs(hometown.lat)).toFixed(1);

export const homes: HomesContent = {
  facts: [
    { label: hometown.name, when: `Born, ${site.life.bornLabel}` },
    { label: site.life.grewUpIn, when: `From ${site.life.arrivedLabel}` },
    { label: home.name, when: `Since ${site.life.movedToAucklandLabel}` },
  ],
  split: {
    hometown: hometown.name,
    newZealand: "New Zealand",
    years: (count) => `${hometown.name}, ${count} years`,
    yearsCounting: (count) => `New Zealand, ${count} years and counting`,
  },
  percentCaption: "of my life in Aotearoa, New Zealand",
  crossover: {
    before: "New Zealand becomes the majority around",
    after: "New Zealand became the majority around",
  },
  // Built only from facts the owner has given. Rewrite in your own words any time.
  story:
    `I was born in ${hometown.name}, a railway city on the plains of Henan, and lived there until I was ten. ` +
    `In July 2016 I moved to New Zealand, and I grew up in ${site.life.grewUpIn}. ` +
    `In March 2024 I moved to ${home.name} for university, and I live here now.`,
  placeholder: false,
  map: {
    description:
      "A map of East Asia and the western Pacific, from China down to New Zealand, drawn as small squares. " +
      `${hometown.name}, at ${hometown.latLabel} in central China, is marked in red with eight short rail lines radiating from it. ` +
      `A flight path curves ${distance} km across the equator to ${home.name}, at ${home.latLabel} in New Zealand. ` +
      `${site.life.grewUpIn}, where I grew up, is about 120 km south of ${home.name}.`,
    clockSentence: (hours) =>
      `Clocks in New Zealand run ${hours} ${hours === 1 ? "hour" : "hours"} ahead of ${hometown.name}.`,
    flippedSentence: `The map is currently mirrored across the equator, which puts ${hometown.name} close to ${home.name}'s latitude.`,
    equator: "Equator",
    clock: "clock",
    flip: {
      button: "Flip the world",
      note: `Mirrored across the equator, ${hometown.name} at ${hometown.latLabel} lands ${latitudeGap}° from ${home.name}'s latitude, ${home.latLabel}.`,
    },
  },
};
