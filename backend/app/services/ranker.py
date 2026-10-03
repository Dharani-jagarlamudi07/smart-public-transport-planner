from typing import List, Dict, Any


def rank_and_explain(itineraries: List[Dict[str, Any]], preference: str = "balanced") -> List[Dict[str, Any]]:
    if not itineraries:
        return []

    # Find baseline metrics for comparison
    min_duration = min(it["duration_sec"] for it in itineraries)
    min_transfers = min(it["transfers"] for it in itineraries)
    min_walk = min(it["walk_distance_m"] for it in itineraries)

    for it in itineraries:
        duration_min = it["duration_sec"] / 60.0
        walk_km = it["walk_distance_m"] / 1000.0
        transfers = it["transfers"]
        fare = it.get("fare") or 0

        # Scoring logic based on preference
        if preference == "fastest":
            score = duration_min + transfers * 0.5
        elif preference == "fewest_transfers":
            score = duration_min * 0.5 + transfers * 10
        elif preference == "least_walking":
            score = duration_min * 0.5 + walk_km * 10
        elif preference == "accessible":
            score = duration_min * 0.6 + walk_km * 8 + transfers * 4
        else: # balanced
            score = duration_min + transfers * 3 + walk_km * 5 + fare * 0.1

        it["score"] = round(score, 2)

        # Generate human-readable explanation
        reasons = []

        if it["duration_sec"] == min_duration:
            reasons.append("the fastest travel time")

        if it["transfers"] == min_transfers:
            reasons.append("the fewest transfers")

        if it["walk_distance_m"] == min_walk:
            reasons.append("the least walking distance")

        if not reasons:
            reasons.append("a good balance of time, transfers, and walking")

        it["recommendation_reason"] = "This option has " + ", ".join(reasons) + "."

    # Sort by score (lowest is best)
    itineraries.sort(key=lambda x: x["score"])

    # Mark the top result explicitly
    if itineraries:
        itineraries[0]["recommendation_reason"] = (
            "Recommended: " + itineraries[0]["recommendation_reason"]
        )

    return itineraries