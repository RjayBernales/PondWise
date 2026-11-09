// PondWise v1 - built-in species list.
// This is the offline fallback. Live search uses the FishBase API when online.
// Feeding rates below are starting guides (% body weight per day), not vet advice.

var SPECIES_LIST = [
  { common: "Nile tilapia", scientific: "Oreochromis niloticus", rate: 3 },
  { common: "Mozambique tilapia", scientific: "Oreochromis mossambicus", rate: 3 },
  { common: "African catfish", scientific: "Clarias gariepinus", rate: 3.5 },
  { common: "Channel catfish", scientific: "Ictalurus punctatus", rate: 2.5 },
  { common: "Milkfish", scientific: "Chanos chanos", rate: 4 },
  { common: "Common carp", scientific: "Cyprinus carpio", rate: 3 },
  { common: "Grass carp", scientific: "Ctenopharyngodon idella", rate: 3 },
  { common: "Silver carp", scientific: "Hypophthalmichthys molitrix", rate: 3 },
  { common: "Giant gourami", scientific: "Osphronemus goramy", rate: 2.5 },
  { common: "Striped snakehead", scientific: "Channa striata", rate: 4 }
];

// Suggest a feeding rate from average weight when species is unknown.
// Small fish eat a bigger % of their weight than big fish.
function suggestRateByWeight(avgWeightG) {
  if (avgWeightG < 10) return 8;
  if (avgWeightG < 50) return 5;
  if (avgWeightG < 200) return 3.5;
  if (avgWeightG < 500) return 2.5;
  return 2;
}
